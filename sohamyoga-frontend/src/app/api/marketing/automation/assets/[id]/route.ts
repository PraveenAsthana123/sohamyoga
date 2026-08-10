// PATCH /api/marketing/automation/assets/:id — { action: 'approve' | 'reject' }
// Closes the loop on the review_required stage: once every asset for a
// request is approved, the request itself moves to 'approved'.

import { NextRequest } from 'next/server';
import { databaseConfigured, query, transaction } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { action?: string } | null;
  if (body?.action !== 'approve' && body?.action !== 'reject') {
    return Response.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }
  const nextStatus = body.action === 'approve' ? 'approved' : 'rejected';

  const asset = await query<{ request_id: string }>(
    `UPDATE generated_marketing_asset SET status = $1, approved_at = CASE WHEN $1 = 'approved' THEN now() ELSE approved_at END
     WHERE id = $2 RETURNING request_id`,
    [nextStatus, params.id],
  );
  if (!asset.rows.length) return Response.json({ error: 'Asset not found.' }, { status: 404 });
  const requestId = asset.rows[0].request_id;

  await transaction(async client => {
    const remaining = await client.query<{ status: string; count: string }>(
      `SELECT status, COUNT(*) AS count FROM generated_marketing_asset WHERE request_id = $1 GROUP BY status`,
      [requestId],
    );
    const counts = Object.fromEntries(remaining.rows.map(r => [r.status, Number(r.count)]));
    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    if (counts.rejected > 0) {
      await client.query(
        `UPDATE marketing_automation_request SET status = 'review_required', current_stage = 'admin_review', updated_at = now() WHERE id = $1`,
        [requestId],
      );
    } else if (counts.approved === total) {
      await client.query(
        `UPDATE marketing_automation_request SET status = 'approved', current_stage = 'ready_to_schedule', progress_percent = 80, updated_at = now() WHERE id = $1`,
        [requestId],
      );
      const req0 = await client.query<{ tenant_id: string }>(`SELECT tenant_id FROM marketing_automation_request WHERE id = $1`, [requestId]);
      await client.query(
        `INSERT INTO marketing_workflow_event (tenant_id, request_id, stage, status, actor_type, message)
         VALUES ($1,$2,'admin_review','approved','admin','All generated assets approved')`,
        [req0.rows[0].tenant_id, requestId],
      );
    }
  });

  return Response.json({ ok: true, status: nextStatus });
}
