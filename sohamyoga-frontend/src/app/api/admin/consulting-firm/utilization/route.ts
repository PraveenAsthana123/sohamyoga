import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT
        consultant,
        SUM(hours) AS total_hours,
        SUM(CASE WHEN billable THEN hours ELSE 0 END) AS billable_hours,
        SUM(CASE WHEN NOT billable THEN hours ELSE 0 END) AS non_billable_hours,
        ROUND(SUM(CASE WHEN billable THEN hours ELSE 0 END) / NULLIF(SUM(hours),0) * 100, 1) AS utilization_rate
      FROM cf_time_entry
      WHERE entry_date >= DATE_TRUNC('month', CURRENT_DATE)
      GROUP BY consultant
      ORDER BY utilization_rate DESC NULLS LAST
    `);
    return Response.json(rows);
  } finally {
    client.release();
  }
}
