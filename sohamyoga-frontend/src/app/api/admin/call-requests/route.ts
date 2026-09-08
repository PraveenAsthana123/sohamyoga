import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUSES = ['requested', 'scheduled', 'completed', 'cancelled'];

// Staff-facing queue for the customer self-service Call In / Call Out
// feature, plus the real dashboard/report numbers behind it — all computed
// live from call_request, never a fabricated count.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const statusFilter = req.nextUrl.searchParams.get('status');
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (statusFilter && STATUSES.includes(statusFilter)) {
    params.push(statusFilter);
    conditions.push(`cr.status = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [requests, dashboard] = await Promise.all([
    query(
      `SELECT cr.id, cr.direction, cr.reason, cr.phone, cr.preferred_time, cr.status, cr.outcome_notes,
              cr.completed_at, cr.created_at, c.display_name AS customer_name, c.email AS customer_email
       FROM call_request cr JOIN customer c ON c.id = cr.customer_id
       ${where}
       ORDER BY cr.created_at DESC LIMIT 200`,
      params,
    ),
    query<{
      open_count: string; call_in_open: string; call_out_open: string;
      completed_today: string; avg_response_minutes: string | null;
    }>(
      `SELECT
         count(*) FILTER (WHERE status IN ('requested','scheduled')) AS open_count,
         count(*) FILTER (WHERE status IN ('requested','scheduled') AND direction = 'call_in') AS call_in_open,
         count(*) FILTER (WHERE status IN ('requested','scheduled') AND direction = 'call_out') AS call_out_open,
         count(*) FILTER (WHERE status = 'completed' AND completed_at >= CURRENT_DATE) AS completed_today,
         round(avg(EXTRACT(EPOCH FROM (completed_at - created_at)) / 60)
           FILTER (WHERE status = 'completed' AND completed_at IS NOT NULL))::text AS avg_response_minutes
       FROM call_request`,
    ),
  ]);

  const d = dashboard.rows[0];
  return Response.json({
    requests: requests.rows,
    dashboard: {
      openCount: Number(d.open_count),
      callInOpen: Number(d.call_in_open),
      callOutOpen: Number(d.call_out_open),
      completedToday: Number(d.completed_today),
      avgResponseMinutes: d.avg_response_minutes !== null ? Number(d.avg_response_minutes) : null,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    requestId?: string; status?: string; outcomeNotes?: string;
  } | null;
  if (!body?.requestId || !body.status || !STATUSES.includes(body.status)) {
    return Response.json({ error: `requestId and a valid status (${STATUSES.join('|')}) are required.` }, { status: 400 });
  }

  const completedAtClause = body.status === 'completed' ? `, completed_at = now()` : '';
  const result = await query(
    `UPDATE call_request SET status = $2, outcome_notes = COALESCE($3, outcome_notes), updated_at = now() ${completedAtClause}
     WHERE id = $1 RETURNING id, status, outcome_notes, completed_at`,
    [body.requestId, body.status, body.outcomeNotes ?? null],
  );
  if (!result.rowCount) return Response.json({ error: 'Request not found.' }, { status: 404 });
  return Response.json({ request: result.rows[0] });
}
