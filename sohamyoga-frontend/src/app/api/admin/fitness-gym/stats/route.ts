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
      const [trendRes, popularityRes, membershipRes] = await Promise.all([
        client.query(`
          SELECT TO_CHAR(DATE_TRUNC('month', checked_in_at), 'Mon YYYY') AS month,
                 DATE_TRUNC('month', checked_in_at) AS month_dt,
                 COUNT(*) AS checkins
          FROM gym_checkin
          WHERE checked_in_at >= NOW() - INTERVAL '6 months'
          GROUP BY DATE_TRUNC('month', checked_in_at)
          ORDER BY month_dt
        `),
        client.query(`
          SELECT gc.name, gc.instructor, gc.class_type,
                 COUNT(gb.id) FILTER (WHERE gb.status IN ('booked','attended')) AS total_bookings,
                 COUNT(gb.id) FILTER (WHERE gb.status='attended') AS attended
          FROM gym_class gc
          LEFT JOIN gym_booking gb ON gb.class_id = gc.id
          WHERE gc.is_active = true
          GROUP BY gc.id ORDER BY total_bookings DESC LIMIT 10
        `),
        client.query(`
          SELECT membership_type, COUNT(*) AS count
          FROM gym_member WHERE membership_status = 'active'
          GROUP BY membership_type ORDER BY count DESC
        `),
      ]);
      return Response.json({
        monthly_checkins_trend: trendRes.rows,
        class_popularity: popularityRes.rows,
        membership_breakdown: membershipRes.rows,
      });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
