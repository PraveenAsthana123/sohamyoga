import { NextRequest } from 'next/server';
import { requireAdmin } from '../../../../lib/session-auth';
import { query } from '../../../../lib/postgres';

const STATUSES = new Set(['draft', 'review', 'approved', 'archived']);
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req); if (denied) return denied;
  const { id } = await context.params;
  const result = await query(`SELECT * FROM meeting_report WHERE id=$1`, [id]);
  if (!result.rowCount) return Response.json({ error: 'Report not found.' }, { status: 404 });
  const events = await query(`SELECT * FROM meeting_report_event WHERE report_id=$1 ORDER BY created_at DESC`, [id]);
  return Response.json({ report: result.rows[0], events: events.rows });
}
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req); if (denied) return denied;
  const { id } = await context.params;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  const status = String(body.status ?? 'draft');
  if (!STATUSES.has(status)) return Response.json({ error: 'Invalid status.' }, { status: 400 });
  const result = await query(`UPDATE meeting_report SET title=$2,customer_name=$3,meeting_at=$4,objective=$5,
    participants=$6::jsonb,sections=$7::jsonb,evidence=$8::jsonb,action_items=$9::jsonb,status=$10,updated_at=now()
    WHERE id=$1 RETURNING id`, [id, String(body.title ?? '').trim(), String(body.customerName ?? '').trim(), body.meetingAt || null,
    String(body.objective ?? ''), JSON.stringify(body.participants ?? []), JSON.stringify(body.sections ?? {}),
    JSON.stringify(body.evidence ?? []), JSON.stringify(body.actionItems ?? []), status]);
  if (!result.rowCount) return Response.json({ error: 'Report not found.' }, { status: 404 });
  await query(`INSERT INTO meeting_report_event (report_id,event_type,detail) VALUES ($1,'updated',$2::jsonb)`, [id, JSON.stringify({ status })]);
  return Response.json({ ok: true });
}
