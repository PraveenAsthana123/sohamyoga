import { NextRequest } from 'next/server';
import { requireAdmin } from '../../../lib/session-auth';
import { query } from '../../../lib/postgres';
import { withApiErrorLog } from '../../../lib/api-error-log';

async function handleGet(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const w = await query<{ id: string }>(`SELECT id FROM marketing_workspace ORDER BY created_at LIMIT 1`);
  const workspaceId = w.rows[0]?.id;
  if (!workspaceId) return Response.json({ error: 'Workspace missing.' }, { status: 503 });
  const result = await query(
    `SELECT * FROM email_template WHERE workspace_id = $1 ORDER BY created_at DESC`,
    [workspaceId],
  );
  return Response.json({ templates: result.rows });
}

const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

async function handlePost(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null) as { name?: string; subject?: string; body?: string } | null;
  if (!body?.name || !body?.subject || !body?.body) {
    return Response.json({ error: 'name, subject and body are required.' }, { status: 400 });
  }
  const w = await query<{ id: string }>(`SELECT id FROM marketing_workspace ORDER BY created_at LIMIT 1`);
  const workspaceId = w.rows[0]?.id;
  if (!workspaceId) return Response.json({ error: 'Workspace missing.' }, { status: 503 });

  // Real variable extraction from {{token}} syntax in subject+body — not a
  // freeform tag list an author has to remember to keep in sync.
  const found = new Set<string>();
  for (const m of `${body.subject}\n${body.body}`.matchAll(VARIABLE_PATTERN)) found.add(m[1]);

  const result = await query(
    `INSERT INTO email_template (workspace_id, name, subject, body, variables) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [workspaceId, body.name, body.subject, body.body, Array.from(found)],
  );
  return Response.json({ template: result.rows[0] }, { status: 201 });
}

async function handlePatch(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null) as { templateId?: string; action?: string } | null;
  if (!body?.templateId || !['approve', 'archive'].includes(body.action ?? '')) {
    return Response.json({ error: 'templateId and a valid action (approve|archive) are required.' }, { status: 400 });
  }
  const setClause = body.action === 'approve'
    ? `status='approved', approved_by='admin', approved_at=now(), updated_at=now()`
    : `status='archived', updated_at=now()`;
  const result = await query(`UPDATE email_template SET ${setClause} WHERE id=$1 RETURNING *`, [body.templateId]);
  if (!result.rowCount) return Response.json({ error: 'Template not found.' }, { status: 404 });
  return Response.json({ template: result.rows[0] });
}

export const GET = withApiErrorLog(handleGet);
export const POST = withApiErrorLog(handlePost);
export const PATCH = withApiErrorLog(handlePatch);
