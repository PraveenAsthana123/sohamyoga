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
    const url = new URL(req.url);
    const limit = Math.min(100, parseInt(url.searchParams.get('limit') ?? '50'));
    const offset = parseInt(url.searchParams.get('offset') ?? '0');
    const agent = url.searchParams.get('agent');

    const params: (string | number)[] = [limit, offset];
    let whereClause = '';
    if (agent) {
      params.push(agent);
      whereClause = `WHERE agent_name = $${params.length}`;
    }

    const { rows } = await client.query(
      `SELECT * FROM agentops_runs ${whereClause} ORDER BY started_at DESC LIMIT $1 OFFSET $2`,
      params
    ).catch(() => ({ rows: [] }));

    const { rows: total } = await client.query(
      `SELECT COUNT(*)::int AS c FROM agentops_runs ${whereClause}`,
      agent ? [agent] : []
    ).catch(() => ({ rows: [{ c: 0 }] }));

    return Response.json({ runs: rows, total: total[0].c });
  } finally {
    client.release();
  }
}
