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
    const today = new Date().toISOString().slice(0,10);
    const [summaryRes, categoryRes] = await Promise.all([
      client.query(`
        SELECT COUNT(*) AS transaction_count, COALESCE(SUM(total_amount),0) AS total_revenue, COALESCE(SUM(total_thc_grams),0) AS thc_grams_sold_today
        FROM cr_sale WHERE DATE(sale_date)=$1
      `, [today]),
      client.query(`
        SELECT p.category, SUM(si.quantity) AS units, SUM(si.line_total) AS revenue
        FROM cr_sale_item si JOIN cr_product p ON p.id=si.product_id JOIN cr_sale s ON s.id=si.sale_id
        WHERE DATE(s.sale_date)=$1 GROUP BY p.category ORDER BY revenue DESC
      `, [today]),
    ]);
    return Response.json({ ...summaryRes.rows[0], by_category: categoryRes.rows });
  } finally { client.release(); }
}
