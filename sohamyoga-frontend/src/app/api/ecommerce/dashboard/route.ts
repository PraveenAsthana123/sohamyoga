import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const [kpis, revenueByType, statusBreakdown] = await Promise.all([
    query<{ today_revenue: string; pending_orders: string; active_products: string; low_stock: string; out_of_stock: string }>(
      `SELECT
         (SELECT COALESCE(SUM(total), 0) FROM sales_order WHERE payment_status = 'paid' AND created_at >= CURRENT_DATE) AS today_revenue,
         (SELECT COUNT(*) FROM sales_order WHERE status = 'pending') AS pending_orders,
         (SELECT COUNT(*) FROM product_master WHERE status = 'active') AS active_products,
         (SELECT COUNT(*) FROM inventory WHERE quantity > 0 AND quantity <= reorder_point) AS low_stock,
         (SELECT COUNT(*) FROM inventory WHERE quantity = 0) AS out_of_stock`,
    ),
    query<{ product_type: string; revenue: string }>(
      `SELECT product_type, SUM(total_amount) AS revenue FROM order_item
       GROUP BY product_type ORDER BY revenue DESC`,
    ),
    query<{ status: string; count: string }>(
      `SELECT status, COUNT(*) AS count FROM sales_order GROUP BY status`,
    ),
  ]);

  const totalOrderRevenue = revenueByType.rows.reduce((sum, r) => sum + Number(r.revenue), 0);
  const totalOrders = statusBreakdown.rows.reduce((sum, r) => sum + Number(r.count), 0);
  const row = kpis.rows[0];

  return Response.json({
    kpis: {
      todayRevenue: Number(row?.today_revenue ?? 0),
      pendingOrders: Number(row?.pending_orders ?? 0),
      activeProducts: Number(row?.active_products ?? 0),
      lowStock: Number(row?.low_stock ?? 0),
      outOfStock: Number(row?.out_of_stock ?? 0),
    },
    revenueByType: revenueByType.rows.map(r => ({
      type: r.product_type, revenue: Number(r.revenue),
      pct: totalOrderRevenue ? Math.round((Number(r.revenue) / totalOrderRevenue) * 100) : 0,
    })),
    ordersByStatus: statusBreakdown.rows.map(r => ({
      status: r.status, count: Number(r.count),
      pct: totalOrders ? Math.round((Number(r.count) / totalOrders) * 100) : 0,
    })),
    totalOrders,
  });
}
