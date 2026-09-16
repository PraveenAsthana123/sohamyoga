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
        channel,
        COUNT(*)::int AS volume,
        ROUND(AVG(response_time_minutes)::numeric, 1) AS avg_response_time,
        ROUND(100.0 * COUNT(*) FILTER (WHERE resolved) / NULLIF(COUNT(*),0), 1)::numeric AS resolution_rate,
        COUNT(*) FILTER (WHERE sentiment='positive')::int AS positive_count,
        COUNT(*) FILTER (WHERE sentiment='negative')::int AS negative_count
      FROM omnichannel_touchpoints
      GROUP BY channel
      ORDER BY volume DESC
    `).catch(() => ({ rows: [] }));

    return Response.json({ channels: rows });
  } finally {
    client.release();
  }
}
