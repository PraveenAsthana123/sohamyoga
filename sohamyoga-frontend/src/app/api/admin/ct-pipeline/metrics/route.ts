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
    const [byCatRes, slowestRes, mostFailingRes] = await Promise.all([
      client.query(`
        SELECT
          category,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'healthy')::int AS healthy,
          ROUND(100.0 * SUM(run_count - failure_count) / NULLIF(SUM(run_count), 0), 1) AS success_rate_pct
        FROM pipeline_health
        GROUP BY category
        ORDER BY category
      `).catch(() => ({ rows: [] })),
      client.query(`
        SELECT pipeline_name, category, avg_duration_ms, status
        FROM pipeline_health
        ORDER BY avg_duration_ms DESC LIMIT 5
      `).catch(() => ({ rows: [] })),
      client.query(`
        SELECT pipeline_name, category, failure_count, run_count,
          ROUND(100.0 * failure_count / NULLIF(run_count, 0), 1) AS failure_rate_pct
        FROM pipeline_health
        ORDER BY failure_count DESC LIMIT 5
      `).catch(() => ({ rows: [] })),
    ]);

    return Response.json({
      by_category: byCatRes.rows,
      slowest_pipelines: slowestRes.rows,
      most_failing: mostFailingRes.rows,
    });
  } finally {
    client.release();
  }
}
