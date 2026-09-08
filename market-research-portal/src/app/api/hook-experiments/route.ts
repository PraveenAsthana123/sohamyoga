import { NextRequest } from 'next/server';
import { requireAdmin } from '../../../lib/session-auth';
import { query } from '../../../lib/postgres';
import { withApiErrorLog } from '../../../lib/api-error-log';
import { twoProportionZTest } from '../../../domain/pipeline/HookZTest';

async function wid() {
  const r = await query<{ id: string }>(`SELECT id FROM marketing_workspace ORDER BY created_at LIMIT 1`);
  return r.rows[0]?.id;
}

async function hookAgg(hookId: string) {
  const r = await query<{ views: string; completions: string }>(
    `SELECT coalesce(sum(m.views), 0) AS views, coalesce(sum(m.completions), 0) AS completions
     FROM content_factory_variant v JOIN content_factory_metric m ON m.variant_id = v.id
     WHERE v.hook_id = $1`,
    [hookId],
  );
  return { views: Number(r.rows[0]?.views ?? 0), completions: Number(r.rows[0]?.completions ?? 0) };
}

// The comparison is always computed live from current content_factory_metric
// numbers, never stored — so it can't go stale or misreport a result reached
// before the 30-views-per-arm floor was crossed.
async function withComparison(exp: any) {
  const [a, b] = await Promise.all([hookAgg(exp.hook_a_id), hookAgg(exp.hook_b_id)]);
  const comparison = twoProportionZTest(a.completions, a.views, b.completions, b.views);
  return { ...exp, hookAStats: a, hookBStats: b, comparison };
}

async function handleGet(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const w = await wid();
  if (!w) return Response.json({ error: 'Workspace missing.' }, { status: 503 });
  const result = await query(
    `SELECT e.*, ha.text AS hook_a_text, hb.text AS hook_b_text
     FROM hook_experiment e
     JOIN content_hook ha ON ha.id = e.hook_a_id
     JOIN content_hook hb ON hb.id = e.hook_b_id
     WHERE e.workspace_id = $1 ORDER BY e.created_at DESC`,
    [w],
  );
  const experiments = await Promise.all(result.rows.map((row: any) => withComparison(row)));
  return Response.json({ experiments });
}

async function handlePost(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const w = await wid();
  if (!w) return Response.json({ error: 'Workspace missing.' }, { status: 503 });
  const body = await req.json().catch(() => null) as { name?: string; hookAId?: string; hookBId?: string } | null;
  if (!body?.name || !body.hookAId || !body.hookBId) {
    return Response.json({ error: 'name, hookAId and hookBId are required.' }, { status: 400 });
  }
  if (body.hookAId === body.hookBId) {
    return Response.json({ error: 'hookAId and hookBId must be different hooks.' }, { status: 400 });
  }
  const hooks = await query(`SELECT id FROM content_hook WHERE id = ANY($1) AND workspace_id = $2`, [[body.hookAId, body.hookBId], w]);
  if (hooks.rowCount !== 2) return Response.json({ error: 'Both hooks must exist in this workspace.' }, { status: 400 });

  const result = await query(
    `INSERT INTO hook_experiment (workspace_id, name, hook_a_id, hook_b_id) VALUES ($1,$2,$3,$4) RETURNING *`,
    [w, body.name, body.hookAId, body.hookBId],
  );
  return Response.json({ experiment: await withComparison(result.rows[0]) }, { status: 201 });
}

async function handlePatch(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null) as { experimentId?: string; action?: string } | null;
  if (!body?.experimentId || body.action !== 'conclude') {
    return Response.json({ error: 'experimentId and action=conclude are required.' }, { status: 400 });
  }
  const existing = await query(`SELECT * FROM hook_experiment WHERE id = $1`, [body.experimentId]);
  if (!existing.rowCount) return Response.json({ error: 'Experiment not found.' }, { status: 404 });
  const withStats = await withComparison(existing.rows[0]);
  if (!withStats.comparison.hasEnoughData) {
    return Response.json({ error: 'Cannot conclude — fewer than 30 real measured views on one or both hooks so far.' }, { status: 400 });
  }
  const winnerId = withStats.comparison.winner === 'a' ? withStats.hook_a_id : withStats.comparison.winner === 'b' ? withStats.hook_b_id : null;
  const result = await query(
    `UPDATE hook_experiment SET status = 'concluded', winner_hook_id = $2, concluded_at = now() WHERE id = $1 RETURNING *`,
    [body.experimentId, winnerId],
  );
  return Response.json({ experiment: await withComparison(result.rows[0]) });
}

export const GET = withApiErrorLog(handleGet);
export const POST = withApiErrorLog(handlePost);
export const PATCH = withApiErrorLog(handlePatch);
