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
      SELECT a.*,
        COUNT(r.id)::int AS run_count,
        COUNT(r.id) FILTER (WHERE r.status = 'completed')::int AS success_count,
        ROUND(SUM(r.cost_usd)::numeric, 4) AS total_cost_usd,
        MAX(r.started_at) AS last_run
      FROM agentops_agents a
      LEFT JOIN agentops_runs r ON r.agent_name = a.name
      GROUP BY a.id
      ORDER BY a.total_runs DESC
    `).catch(() => ({ rows: [] }));

    return Response.json({ agents: rows });
  } finally {
    client.release();
  }
}
