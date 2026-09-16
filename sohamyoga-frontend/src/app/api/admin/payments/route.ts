export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const client = await pool.connect();
  try {
    // Real payment transactions joined with order for customer email
    const paymentsRes = await client.query(`
      SELECT p.id, p.payment_method, p.amount, p.currency, p.status,
        p.provider_ref, p.refunded_amount, p.created_at,
        o.order_number, o.customer_email
      FROM payment p
      LEFT JOIN sales_order o ON o.id = p.order_id
      ORDER BY p.created_at DESC
      LIMIT 100
    `);

    // Invoice summary from invoice_mirror
    const invoiceRes = await client.query(`
      SELECT status, COUNT(*) as count, SUM(total_cad) as total_cad
      FROM invoice_mirror
      GROUP BY status
    `);

    const invoiceTotal = await client.query(`
      SELECT
        COUNT(*) as total_count,
        SUM(total_cad) as total_revenue,
        SUM(CASE WHEN status = 'paid' THEN total_cad ELSE 0 END) as paid_revenue,
        SUM(CASE WHEN status IN ('submitted','overdue') THEN total_cad ELSE 0 END) as outstanding
      FROM invoice_mirror
    `);

    // Wallet transaction summary
    const walletRes = await client.query(`
      SELECT wt.id, wt.type, wt.amount, wt.points_delta, wt.description, wt.created_at,
        w.balance_cad
      FROM wallet_transaction wt
      LEFT JOIN wallet w ON w.id = wt.wallet_id
      ORDER BY wt.created_at DESC
      LIMIT 50
    `).catch(() => ({ rows: [] }));

    // Payment summary
    const paymentSummary = {
      total: paymentsRes.rowCount ?? 0,
      succeeded: paymentsRes.rows.filter(p => p.status === 'succeeded').length,
      failed: paymentsRes.rows.filter(p => p.status === 'failed').length,
      refunded: paymentsRes.rows.filter(p => p.status === 'refunded').length,
      totalAmount: paymentsRes.rows
        .filter(p => p.status === 'succeeded')
        .reduce((s, p) => s + Number(p.amount ?? 0), 0),
    };

    return NextResponse.json({
      summary: paymentSummary,
      payments: paymentsRes.rows,
      invoiceSummary: invoiceRes.rows,
      invoiceTotals: invoiceTotal.rows[0] ?? {},
      walletTransactions: walletRes.rows,
    });
  } finally {
    client.release();
  }
}
