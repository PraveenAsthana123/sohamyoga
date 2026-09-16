import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT
        c.id AS client_id,
        c.name AS client_name,
        c.assigned_cpa,
        COUNT(t.id) AS entry_count,
        SUM(t.hours) AS total_hours,
        SUM(COALESCE(t.hours * t.rate, 0)) AS wip_value
      FROM accounting_client c
      LEFT JOIN accounting_time_entry t ON t.client_id = c.id AND t.billable = true AND t.billed = false
      GROUP BY c.id, c.name, c.assigned_cpa
      HAVING SUM(COALESCE(t.hours * t.rate, 0)) > 0 OR COUNT(t.id) > 0
      ORDER BY wip_value DESC NULLS LAST
    `);
    const total = rows.reduce((sum: number, r) => sum + Number(r.wip_value ?? 0), 0);
    return Response.json({ wip: rows, total });
  } finally {
    client.release();
  }
}
