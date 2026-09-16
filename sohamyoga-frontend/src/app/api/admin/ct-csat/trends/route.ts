export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export async function GET(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT
        TO_CHAR(date_trunc('week', responded_at), 'Mon DD') AS week_label,
        ROUND(AVG(score)::numeric, 2) AS avg_score,
        COUNT(*)::int AS response_count
      FROM csat_responses
      WHERE responded_at >= NOW() - INTERVAL '6 weeks'
      GROUP BY date_trunc('week', responded_at)
      ORDER BY date_trunc('week', responded_at) ASC
    `).catch(() => ({ rows: [] }));

    return Response.json({ trends: rows });
  } finally {
    client.release();
  }
}
