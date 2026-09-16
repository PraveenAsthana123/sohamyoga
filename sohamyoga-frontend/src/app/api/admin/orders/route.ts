import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? '';

  const client = await pool.connect();
  try {
    const conditions: string[] = [];
    const values: string[] = [];
    if (status && status !== 'all') {
      conditions.push(`status = $${values.length + 1}`);
      values.push(status);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [orders, statusSummary, revenueSummary] = await Promise.all([
      client.query(
        `SELECT id, order_number, customer_email, status, payment_status, fulfillment_status,
                subtotal, tax_amount, total, currency, refund_amount, created_at
         FROM sales_order ${where}
         ORDER BY created_at DESC LIMIT 500`,
        values,
      ),
      client.query(
        `SELECT status, COUNT(*)::int AS cnt, COALESCE(SUM(total),0)::numeric AS revenue
         FROM sales_order GROUP BY status ORDER BY status`,
      ),
      client.query(
        `SELECT
           COUNT(*)::int AS total_orders,
           COALESCE(SUM(total) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'), 0)::numeric AS revenue_30d,
           COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
           CASE WHEN COUNT(*) > 0 THEN (SUM(total) / COUNT(*))::numeric ELSE 0 END AS avg_order_value
         FROM sales_order`,
      ),
    ]);

    return Response.json({
      orders: orders.rows.map((o: Record<string, unknown>) => ({
        ...o,
        total: Number(o.total),
        subtotal: Number(o.subtotal),
        taxAmount: Number(o.tax_amount),
        refundAmount: Number(o.refund_amount),
      })),
      statusSummary: statusSummary.rows.map((r: Record<string, unknown>) => ({
        status: r.status,
        count: r.cnt,
        revenue: Number(r.revenue),
      })),
      kpi: {
        totalOrders: revenueSummary.rows[0].total_orders,
        revenue30d: Number(revenueSummary.rows[0].revenue_30d),
        pending: revenueSummary.rows[0].pending,
        avgOrderValue: Number(revenueSummary.rows[0].avg_order_value),
      },
    });
  } finally {
    client.release();
  }
}
