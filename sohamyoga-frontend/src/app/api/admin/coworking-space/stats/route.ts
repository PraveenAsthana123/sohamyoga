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
    const [occupancy, revenue, peakHours] = await Promise.all([
      client.query(`
        SELECT s.space_type,
               COUNT(DISTINCT s.id) AS total_spaces,
               COUNT(DISTINCT b.space_id) AS booked_today
        FROM cw_space s
        LEFT JOIN cw_booking b ON b.space_id = s.id
          AND b.booking_date = CURRENT_DATE
          AND b.status IN ('confirmed','checked_in')
        GROUP BY s.space_type
        ORDER BY s.space_type
      `),
      client.query(`
        SELECT m.membership_plan,
               COUNT(DISTINCT m.id) AS member_count,
               COALESCE(SUM(b.amount_charged), 0) AS revenue_mtd
        FROM cw_member m
        LEFT JOIN cw_booking b ON b.member_id = m.id
          AND date_trunc('month', b.booking_date) = date_trunc('month', CURRENT_DATE)
          AND b.status = 'completed'
        WHERE m.membership_status = 'active'
        GROUP BY m.membership_plan
        ORDER BY revenue_mtd DESC
      `),
      client.query(`
        SELECT EXTRACT(HOUR FROM start_time) AS hour,
               COUNT(*) AS bookings
        FROM cw_booking
        WHERE booking_date >= CURRENT_DATE - INTERVAL '30 days'
          AND status NOT IN ('cancelled','no_show')
        GROUP BY EXTRACT(HOUR FROM start_time)
        ORDER BY hour
      `),
    ]);
    return Response.json({
      occupancy_by_type: occupancy.rows,
      revenue_by_plan: revenue.rows,
      peak_hours_heatmap: peakHours.rows,
    });
  } finally {
    client.release();
  }
}
