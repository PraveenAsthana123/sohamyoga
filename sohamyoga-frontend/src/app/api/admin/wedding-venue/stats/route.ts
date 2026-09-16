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
    const [revenueByMonth, bookingsByStatus, eventTypeBreakdown, conversionRate] = await Promise.all([
      client.query(
        `SELECT TO_CHAR(event_date,'YYYY-MM') AS month,
           COUNT(*) AS bookings,
           COALESCE(SUM(CASE WHEN status IN ('contract_signed','planning','confirmed','completed') THEN total_package_price END),0) AS revenue
         FROM wv_booking WHERE event_date>=NOW()-INTERVAL '12 months' AND status!='cancelled'
         GROUP BY TO_CHAR(event_date,'YYYY-MM') ORDER BY month`
      ),
      client.query(
        `SELECT status, COUNT(*) AS cnt, COALESCE(SUM(total_package_price),0) AS value
         FROM wv_booking WHERE status!='cancelled' GROUP BY status ORDER BY cnt DESC`
      ),
      client.query(
        `SELECT event_type, COUNT(*) AS cnt FROM wv_booking WHERE status!='cancelled' GROUP BY event_type ORDER BY cnt DESC`
      ),
      client.query(
        `SELECT
           COUNT(*) FILTER (WHERE status='inquiry') AS total_inquiries,
           COUNT(*) FILTER (WHERE status IN ('contract_signed','planning','confirmed','completed')) AS converted,
           ROUND(100.0 * COUNT(*) FILTER (WHERE status IN ('contract_signed','planning','confirmed','completed'))
             / NULLIF(COUNT(*),0),1) AS conversion_rate
         FROM wv_booking`
      ),
    ]);

    return Response.json({
      revenue_by_month: revenueByMonth.rows,
      bookings_by_status: bookingsByStatus.rows,
      event_type_breakdown: eventTypeBreakdown.rows,
      conversion: conversionRate.rows[0],
    });
  } finally {
    client.release();
  }
}
