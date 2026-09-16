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
        classification AS driver,
        COUNT(*)::int AS count,
        ROUND(AVG(score)::numeric, 2) AS avg_score,
        COUNT(*) FILTER (WHERE score <= 3)::int AS complaints
      FROM csat_responses
      WHERE classification IS NOT NULL
      GROUP BY classification
      ORDER BY complaints DESC, count DESC
      LIMIT 5
    `).catch(() => ({ rows: [] }));

    return Response.json({ drivers: rows });
  } finally {
    client.release();
  }
}
