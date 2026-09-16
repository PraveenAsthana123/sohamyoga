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
    const [revenueRes, servicesRes, returnRes] = await Promise.all([
      client.query(`
        SELECT DATE(created_at) AS day, COALESCE(SUM(total_amount),0) AS revenue, COUNT(*) AS wo_count
        FROM ar_work_order
        WHERE payment_status='paid' AND created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at) ORDER BY day
      `),
      client.query(`
        SELECT li.description, COUNT(*) AS cnt, SUM(li.unit_price * li.quantity) AS revenue
        FROM ar_line_item li
        JOIN ar_work_order wo ON wo.id = li.work_order_id
        WHERE wo.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY li.description ORDER BY cnt DESC LIMIT 10
      `),
      client.query(`
        SELECT
          COUNT(CASE WHEN c.total_visits = 1 THEN 1 END) AS first_time,
          COUNT(CASE WHEN c.total_visits > 1 THEN 1 END) AS returning
        FROM ar_work_order wo
        JOIN ar_customer c ON c.id = wo.customer_id
        WHERE wo.created_at >= NOW() - INTERVAL '30 days'
      `),
    ]);
    return Response.json({
      revenue_7d: revenueRes.rows,
      top_services: servicesRes.rows,
      customer_ratio: returnRes.rows[0],
    });
  } finally { client.release(); }
}
