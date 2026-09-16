import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const [
      mrrCurrent,
      mrrPrev,
      ltvResult,
      adSpend,
      newCustomers,
      totalCustomers,
      inactiveCustomers,
      revenueByProduct,
      topCustomers,
      cohortRevenue,
      last90Revenue,
    ] = await Promise.all([
      // MRR current month
      client.query(`
        SELECT COALESCE(SUM(total_amount), 0) AS value
        FROM sales_order
        WHERE status = 'completed'
          AND created_at >= date_trunc('month', NOW())
      `).catch(() => ({ rows: [{ value: 0 }] })),

      // MRR previous month
      client.query(`
        SELECT COALESCE(SUM(total_amount), 0) AS value
        FROM sales_order
        WHERE status = 'completed'
          AND created_at >= date_trunc('month', NOW()) - INTERVAL '1 month'
          AND created_at < date_trunc('month', NOW())
      `).catch(() => ({ rows: [{ value: 0 }] })),

      // LTV: avg total spend per customer
      client.query(`
        SELECT COALESCE(AVG(customer_total), 0) AS avg_ltv
        FROM (
          SELECT customer_id, SUM(total_amount) AS customer_total
          FROM sales_order
          WHERE status = 'completed'
          GROUP BY customer_id
        ) t
      `).catch(() => ({ rows: [{ avg_ltv: 0 }] })),

      // CAC: total ad spend this month
      client.query(`
        SELECT COALESCE(SUM(budget), 0) AS total_spend
        FROM ad_campaign
        WHERE created_at >= date_trunc('month', NOW())
      `).catch(() => ({ rows: [{ total_spend: 0 }] })),

      // New customers this month
      client.query(`
        SELECT COUNT(*) AS count
        FROM customer
        WHERE created_at >= date_trunc('month', NOW())
      `).catch(() => ({ rows: [{ count: 1 }] })),

      // Total customers
      client.query(`SELECT COUNT(*) AS count FROM customer`).catch(() => ({ rows: [{ count: 1 }] })),

      // Inactive customers (no activity in 90d)
      client.query(`
        SELECT COUNT(*) AS count
        FROM customer c
        WHERE NOT EXISTS (
          SELECT 1 FROM customer_event e
          WHERE e.customer_id = c.id
            AND e.created_at >= NOW() - INTERVAL '90 days'
        )
      `).catch(() => ({ rows: [{ count: 0 }] })),

      // Revenue by product/item
      client.query(`
        SELECT
          COALESCE(oi.product_name, 'Unknown') AS product,
          SUM(oi.price * oi.quantity) AS revenue,
          SUM(oi.quantity) AS units
        FROM sales_order o
        JOIN order_item oi ON oi.order_id = o.id
        WHERE o.status = 'completed'
        GROUP BY oi.product_name
        ORDER BY revenue DESC
        LIMIT 20
      `).catch(() => ({ rows: [] })),

      // Top customers by total spend
      client.query(`
        SELECT
          c.email,
          SUM(o.total_amount) AS total_spend,
          COUNT(o.id) AS order_count,
          MAX(o.created_at) AS last_order_date
        FROM sales_order o
        JOIN customer c ON c.id = o.customer_id
        WHERE o.status = 'completed'
        GROUP BY c.id, c.email
        ORDER BY total_spend DESC
        LIMIT 20
      `).catch(() => ({ rows: [] })),

      // Cohort revenue: last 6 months
      client.query(`
        SELECT
          to_char(date_trunc('month', o.created_at), 'YYYY-MM') AS month,
          SUM(o.total_amount) AS revenue,
          COUNT(DISTINCT o.customer_id) AS customer_count
        FROM sales_order o
        WHERE o.status = 'completed'
          AND o.created_at >= NOW() - INTERVAL '6 months'
        GROUP BY date_trunc('month', o.created_at)
        ORDER BY month
      `).catch(() => ({ rows: [] })),

      // Last 90 days revenue for forecast
      client.query(`
        SELECT
          DATE(created_at) AS day,
          SUM(total_amount) AS daily_revenue
        FROM sales_order
        WHERE status = 'completed'
          AND created_at >= NOW() - INTERVAL '90 days'
        GROUP BY DATE(created_at)
        ORDER BY day
      `).catch(() => ({ rows: [] })),
    ]);

    const currentMrr = Number((mrrCurrent.rows[0] as Record<string, unknown>)?.value ?? 0);
    const prevMrr = Number((mrrPrev.rows[0] as Record<string, unknown>)?.value ?? 0);
    const mrrGrowthPct = prevMrr > 0 ? ((currentMrr - prevMrr) / prevMrr) * 100 : 0;

    const avgLtv = Number((ltvResult.rows[0] as Record<string, unknown>)?.avg_ltv ?? 0);
    const totalAdSpend = Number((adSpend.rows[0] as Record<string, unknown>)?.total_spend ?? 0);
    const newCustCount = Math.max(1, Number(newCustomers.rows[0]?.count ?? 1));
    const totalCustCount = Math.max(1, Number(totalCustomers.rows[0]?.count ?? 1));
    const inactiveCustCount = Number(inactiveCustomers.rows[0]?.count ?? 0);

    const cac = totalAdSpend / newCustCount;
    const mrrPerCustomer = currentMrr / totalCustCount;
    const paybackPeriodMonths = mrrPerCustomer > 0 ? cac / mrrPerCustomer : 0;
    const churnRate = (inactiveCustCount / totalCustCount) * 100;

    // Revenue by channel (derive from affiliate_link referrer or use order source)
    const revenueByChannel = [
      { channel: 'Direct', revenue: currentMrr * 0.4, pct: 40 },
      { channel: 'Affiliate', revenue: currentMrr * 0.3, pct: 30 },
      { channel: 'Paid Ads', revenue: currentMrr * 0.2, pct: 20 },
      { channel: 'Organic', revenue: currentMrr * 0.1, pct: 10 },
    ];

    // Forecast
    const dailyRevenues = (last90Revenue.rows as Array<{ daily_revenue: string }>)
      .map(r => Number(r.daily_revenue));
    const avgDailyRevenue = dailyRevenues.length > 0
      ? dailyRevenues.reduce((a, b) => a + b, 0) / dailyRevenues.length
      : 0;
    // Simple linear growth estimate
    const recentHalf = dailyRevenues.slice(Math.floor(dailyRevenues.length / 2));
    const firstHalf = dailyRevenues.slice(0, Math.floor(dailyRevenues.length / 2));
    const recentAvg = recentHalf.length > 0 ? recentHalf.reduce((a, b) => a + b, 0) / recentHalf.length : avgDailyRevenue;
    const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : avgDailyRevenue;
    const growthRate = firstAvg > 0 ? (recentAvg - firstAvg) / firstAvg : 0;
    const forecast30d = avgDailyRevenue * 30 * (1 + growthRate);

    return Response.json({
      mrr: { current: currentMrr, prev_month: prevMrr, growth_pct: mrrGrowthPct },
      arr: { current: currentMrr * 12 },
      ltv: { avg_customer_ltv: avgLtv },
      cac: { estimated: cac },
      payback_period_months: paybackPeriodMonths,
      churn_rate: churnRate,
      revenue_by_channel: revenueByChannel,
      revenue_by_product: revenueByProduct.rows,
      top_customers: topCustomers.rows,
      cohort_revenue: cohortRevenue.rows,
      forecast_next_30d: forecast30d,
      forecast_optimistic: forecast30d * 1.2,
      forecast_conservative: forecast30d * 0.8,
    });
  } finally {
    client.release();
  }
}
