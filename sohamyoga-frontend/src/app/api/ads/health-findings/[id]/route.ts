// PATCH /api/ads/health-findings/:id — { action: 'acknowledge' | 'resolve' }
// Human review step for CampaignHealthAuditJob output — the job only ever
// creates 'open' findings, never mutates campaign config itself.

import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { action?: string } | null;
  if (body?.action !== 'acknowledge' && body?.action !== 'resolve') {
    return Response.json({ error: "action must be 'acknowledge' or 'resolve'" }, { status: 400 });
  }
  const nextStatus = body.action === 'acknowledge' ? 'acknowledged' : 'resolved';

  // status is a real Postgres enum (campaign_health_status), not text — $1
  // needs an explicit cast, or Postgres's type inference conflicts between
  // the `status = $1` assignment and the `$1 = 'resolved'` comparison below.
  const result = await query<{ id: string; status: string }>(
    `UPDATE ad_campaign_health_finding
     SET status = $1::campaign_health_status,
         resolved_at = CASE WHEN $1::campaign_health_status = 'resolved' THEN now() ELSE resolved_at END
     WHERE id = $2 RETURNING id, status`,
    [nextStatus, params.id],
  );
  if (!result.rows.length) return Response.json({ error: 'Finding not found.' }, { status: 404 });

  return Response.json({ ok: true, status: result.rows[0].status });
}
