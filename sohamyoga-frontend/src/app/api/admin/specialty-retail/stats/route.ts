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
      const [daily, topProducts, categoryBreakdown, loyaltyTiers, paymentMethods] = await Promise.all([
        client.query(`SELECT DATE(sale_date) AS day, COALESCE(SUM(total_amount),0) AS revenue, COUNT(*) AS transactions FROM sr_sale WHERE sale_date >= NOW() - INTERVAL '7 days' GROUP BY day ORDER BY day`),
        client.query(`SELECT p.name, p.category, SUM(si.line_total) AS revenue, SUM(si.quantity) AS units_sold FROM sr_sale_item si JOIN sr_product p ON p.id=si.product_id GROUP BY p.id, p.name, p.category ORDER BY revenue DESC LIMIT 10`),
        client.query(`SELECT category, COALESCE(SUM(si.line_total),0) AS revenue, SUM(si.quantity) AS units FROM sr_sale_item si JOIN sr_product p ON p.id=si.product_id GROUP BY p.category ORDER BY revenue DESC`),
        client.query(`SELECT loyalty_tier, COUNT(*) AS count FROM sr_customer GROUP BY loyalty_tier ORDER BY CASE loyalty_tier WHEN 'platinum' THEN 1 WHEN 'gold' THEN 2 WHEN 'silver' THEN 3 ELSE 4 END`),
        client.query(`SELECT payment_method, COUNT(*) AS count, COALESCE(SUM(total_amount),0) AS amount FROM sr_sale GROUP BY payment_method ORDER BY amount DESC`),
      ]);
      return NextResponse.json({
        daily_revenue_7d: daily.rows,
        top_products: topProducts.rows,
        category_breakdown: categoryBreakdown.rows,
        loyalty_tier_distribution: loyaltyTiers.rows,
        payment_method_breakdown: paymentMethods.rows,
      });
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
