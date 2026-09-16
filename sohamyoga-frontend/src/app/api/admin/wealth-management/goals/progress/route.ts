import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        SELECT g.*, c.first_name, c.last_name,
          CASE WHEN g.target_amount > 0 THEN ROUND((g.current_amount / g.target_amount * 100)::numeric, 1) ELSE 0 END AS progress_pct,
          CASE WHEN g.target_date IS NOT NULL THEN (g.target_date - CURRENT_DATE) ELSE NULL END AS days_remaining
        FROM wm_goal g
        JOIN wm_client c ON c.id = g.client_id
        ORDER BY g.priority DESC, progress_pct DESC
      `);
      return NextResponse.json(rows);
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
