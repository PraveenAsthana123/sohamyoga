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
      const today = new Date().toISOString().split('T')[0];
      const [summary, byPayment] = await Promise.all([
        client.query(`SELECT COALESCE(SUM(total_amount),0) AS total_revenue, COUNT(*) AS transaction_count, COALESCE(AVG(total_amount),0) AS avg_transaction, COALESCE(SUM(gst_amount),0) AS total_gst FROM sr_sale WHERE DATE(sale_date)=$1`, [today]),
        client.query(`SELECT payment_method, COUNT(*) AS count, SUM(total_amount) AS amount FROM sr_sale WHERE DATE(sale_date)=$1 GROUP BY payment_method`, [today]),
      ]);
      return NextResponse.json({
        date: today,
        total_revenue: parseFloat(summary.rows[0].total_revenue),
        transaction_count: parseInt(summary.rows[0].transaction_count),
        avg_transaction: parseFloat(summary.rows[0].avg_transaction),
        total_gst: parseFloat(summary.rows[0].total_gst),
        payment_breakdown: byPayment.rows,
      });
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
