import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        SELECT
          id, name, age_group, room_name, schedule,
          daily_rate, monthly_fee,
          subsidy_applied, subsidy_amount,
          cwelcc_enrolled,
          CASE WHEN cwelcc_enrolled THEN 10 * 22 ELSE 0 END AS cwelcc_deduction, -- approx 22 working days
          COALESCE(monthly_fee, 0) - COALESCE(subsidy_amount, 0) - CASE WHEN cwelcc_enrolled THEN 220 ELSE 0 END AS parent_responsibility,
          status, enrollment_date
        FROM cc_child
        WHERE status = 'enrolled'
        ORDER BY name ASC
      `);
      const summary = {
        total_monthly_fees: rows.reduce((s, r) => s + parseFloat(r.monthly_fee ?? 0), 0),
        total_subsidy: rows.reduce((s, r) => s + parseFloat(r.subsidy_amount ?? 0), 0),
        total_cwelcc: rows.filter(r => r.cwelcc_enrolled).length * 220,
        total_parent_responsibility: rows.reduce((s, r) => s + parseFloat(r.parent_responsibility ?? 0), 0),
        cwelcc_count: rows.filter(r => r.cwelcc_enrolled).length,
        subsidy_count: rows.filter(r => r.subsidy_applied).length,
        enrolled_count: rows.length,
      };
      return Response.json({ children: rows, summary });
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
