import { NextRequest } from 'next/server';
import { requireAdmin } from '../../../lib/session-auth';
import { query } from '../../../lib/postgres';
import { withApiErrorLog } from '../../../lib/api-error-log';

const STAGE_TYPES = ['hook', 'context', 'value', 'cta'];

async function wid() {
  const r = await query<{ id: string }>(`SELECT id FROM marketing_workspace ORDER BY created_at LIMIT 1`);
  return r.rows[0]?.id;
}

async function handleGet(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const w = await wid();
  if (!w) return Response.json({ error: 'Workspace missing.' }, { status: 503 });

  const flows = await query(`SELECT * FROM topic_flow WHERE workspace_id = $1 ORDER BY created_at DESC`, [w]);
  const stages = await query(
    `SELECT s.* FROM topic_flow_stage s JOIN topic_flow f ON f.id = s.flow_id WHERE f.workspace_id = $1 ORDER BY s.flow_id, s.sequence_order`,
    [w],
  );
  const byFlow = new Map<string, unknown[]>();
  for (const s of stages.rows as { flow_id: string }[]) {
    if (!byFlow.has(s.flow_id)) byFlow.set(s.flow_id, []);
    byFlow.get(s.flow_id)!.push(s);
  }
  const withStages = (flows.rows as { id: string }[]).map(f => ({ ...f, stages: byFlow.get(f.id) ?? [] }));
  return Response.json({ flows: withStages, stageTypes: STAGE_TYPES });
}

async function handlePost(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const w = await wid();
  if (!w) return Response.json({ error: 'Workspace missing.' }, { status: 503 });
  const body = await req.json().catch(() => null) as {
    name?: string; hookId?: string;
    stages?: { stageType?: string; startSecond?: number; durationSeconds?: number; scriptText?: string }[];
  } | null;
  if (!body?.name) return Response.json({ error: 'name is required.' }, { status: 400 });
  for (const s of body.stages ?? []) {
    if (!s.stageType || !STAGE_TYPES.includes(s.stageType)) {
      return Response.json({ error: `Each stage needs a valid stageType (${STAGE_TYPES.join('|')}).` }, { status: 400 });
    }
  }

  const flow = await query<{ id: string }>(
    `INSERT INTO topic_flow (workspace_id, name, hook_id) VALUES ($1,$2,$3) RETURNING id`,
    [w, body.name, body.hookId || null],
  );
  const flowId = flow.rows[0].id;

  let order = 0;
  for (const s of body.stages ?? []) {
    order += 1;
    await query(
      `INSERT INTO topic_flow_stage (flow_id, stage_type, sequence_order, start_second, duration_seconds, script_text)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [flowId, s.stageType, order, s.startSecond || 0, s.durationSeconds || 0, s.scriptText || ''],
    );
  }

  const result = await query(`SELECT * FROM topic_flow WHERE id = $1`, [flowId]);
  return Response.json({ flow: result.rows[0] }, { status: 201 });
}

async function handlePatch(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null) as {
    flowId?: string; action?: string;
    stage?: { stageType?: string; startSecond?: number; durationSeconds?: number; scriptText?: string };
  } | null;
  if (!body?.flowId || body.action !== 'add_stage') {
    return Response.json({ error: 'flowId and action=add_stage are required.' }, { status: 400 });
  }
  const s = body.stage;
  if (!s?.stageType || !STAGE_TYPES.includes(s.stageType)) {
    return Response.json({ error: `stage.stageType must be one of ${STAGE_TYPES.join('|')}.` }, { status: 400 });
  }
  const flow = await query(`SELECT id FROM topic_flow WHERE id = $1`, [body.flowId]);
  if (!flow.rowCount) return Response.json({ error: 'Flow not found.' }, { status: 404 });

  const maxOrder = await query<{ max: number | null }>(
    `SELECT max(sequence_order) AS max FROM topic_flow_stage WHERE flow_id = $1`,
    [body.flowId],
  );
  const nextOrder = (maxOrder.rows[0].max ?? 0) + 1;
  const result = await query(
    `INSERT INTO topic_flow_stage (flow_id, stage_type, sequence_order, start_second, duration_seconds, script_text)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [body.flowId, s.stageType, nextOrder, s.startSecond || 0, s.durationSeconds || 0, s.scriptText || ''],
  );
  await query(`UPDATE topic_flow SET updated_at = now() WHERE id = $1`, [body.flowId]);
  return Response.json({ stage: result.rows[0] });
}

export const GET = withApiErrorLog(handleGet);
export const POST = withApiErrorLog(handlePost);
export const PATCH = withApiErrorLog(handlePatch);
