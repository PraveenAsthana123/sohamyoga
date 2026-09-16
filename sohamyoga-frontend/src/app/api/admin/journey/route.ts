import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['new', 'active', 'paused', 'completed', 'churned'];

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const url = new URL(req.url);
    const statusFilter = url.searchParams.get('status');

    const journeysResult = await client.query<{
      id: string;
      customer_id: string;
      current_phase: string;
      status: string;
      weekly_target_minutes: number;
      current_streak_days: number;
      longest_streak_days: number;
      total_session_count: number;
      total_minutes: number;
      joined_at: string;
      last_practice_at: string | null;
      updated_at: string;
      touchpoint_count: string;
    }>(
      `SELECT
         cj.id, cj.customer_id, cj.current_phase, cj.status,
         cj.weekly_target_minutes, cj.current_streak_days, cj.longest_streak_days,
         cj.total_session_count, cj.total_minutes, cj.joined_at, cj.last_practice_at, cj.updated_at,
         COALESCE(tp.cnt, 0)::text AS touchpoint_count
       FROM customer_journey cj
       LEFT JOIN (
         SELECT contact_identifier, count(*) AS cnt
         FROM journey_touchpoint
         GROUP BY contact_identifier
       ) tp ON tp.contact_identifier = cj.customer_id
       ${statusFilter ? 'WHERE cj.status = $1' : ''}
       ORDER BY cj.updated_at DESC
       LIMIT 200`,
      statusFilter ? [statusFilter] : [],
    );

    // Summary stats
    const statsResult = await client.query<{
      total: string;
      active: string;
      completed: string;
      avg_touchpoints: string;
    }>(
      `SELECT
         count(*)::text AS total,
         count(*) FILTER (WHERE status IN ('active','new'))::text AS active,
         count(*) FILTER (WHERE status = 'completed')::text AS completed,
         COALESCE(avg(total_session_count), 0)::numeric(6,1)::text AS avg_touchpoints
       FROM customer_journey`,
    );

    // Recent audit entries
    const auditResult = await client.query<{
      id: string;
      action: string;
      actor: string;
      customer_id: string | null;
      legal_basis: string | null;
      created_at: string;
    }>(
      `SELECT id, action, actor, customer_id, legal_basis, created_at
       FROM journey_audit
       ORDER BY created_at DESC
       LIMIT 50`,
    );

    return Response.json({
      journeys: journeysResult.rows,
      summary: statsResult.rows[0] ?? { total: '0', active: '0', completed: '0', avg_touchpoints: '0' },
      audit: auditResult.rows,
    });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as { id?: string; status?: string } | null;
  if (!body?.id) return Response.json({ error: 'id is required.' }, { status: 400 });
  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return Response.json({ error: `status must be one of ${VALID_STATUSES.join('|')}` }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE customer_journey SET status = $1, updated_at = now() WHERE id = $2 RETURNING id, status`,
      [body.status, body.id],
    );
    if (!result.rowCount) return Response.json({ error: 'Journey not found.' }, { status: 404 });
    return Response.json({ journey: result.rows[0] });
  } finally {
    client.release();
  }
}
