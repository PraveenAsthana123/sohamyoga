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
    `SELECT l.*, c.name AS campaign_name, f.name AS form_name
     FROM lead l LEFT JOIN campaign c ON c.id = l.campaign_id LEFT JOIN marketing_form_link f ON f.id = l.form_link_id
     WHERE l.workspace_id = $1 ORDER BY l.created_at DESC LIMIT 200`,
    [workspaceId],
  );
  return Response.json({ leads: result.rows });
}

// Admin-created leads (manual entry). Real public form-submission capture
// (marketing_form_link's destination_url) is a separate, deliberately
// unauthenticated endpoint — see /api/leads/capture.
async function handlePost(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null) as { name?: string; email?: string; phone?: string; message?: string; campaignId?: string } | null;
  if (!body?.email && !body?.phone) {
    return Response.json({ error: 'email or phone is required.' }, { status: 400 });
  }
  const w = await query<{ id: string }>(`SELECT id FROM marketing_workspace ORDER BY created_at LIMIT 1`);
  const workspaceId = w.rows[0]?.id;
  if (!workspaceId) return Response.json({ error: 'Workspace missing.' }, { status: 503 });
  const result = await query(
    `INSERT INTO lead (workspace_id, campaign_id, name, email, phone, message, source) VALUES ($1,$2,$3,$4,$5,$6,'manual') RETURNING *`,
    [workspaceId, body.campaignId || null, body.name || null, body.email || null, body.phone || null, body.message || null],
  );
  return Response.json({ lead: result.rows[0] }, { status: 201 });
}

async function handlePatch(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null) as { leadId?: string; status?: string } | null;
  const validStatuses = ['new', 'contacted', 'qualified', 'converted', 'lost'];
  if (!body?.leadId || !validStatuses.includes(body.status ?? '')) {
    return Response.json({ error: `leadId and a valid status (${validStatuses.join('|')}) are required.` }, { status: 400 });
  }
  const result = await query(
    `UPDATE lead SET status=$2, updated_at=now() WHERE id=$1 RETURNING *`,
    [body.leadId, body.status],
  );
  if (!result.rowCount) return Response.json({ error: 'Lead not found.' }, { status: 404 });
  return Response.json({ lead: result.rows[0] });
}

export const GET = withApiErrorLog(handleGet);
export const POST = withApiErrorLog(handlePost);
export const PATCH = withApiErrorLog(handlePatch);
