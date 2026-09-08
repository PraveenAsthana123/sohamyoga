import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real Order Management admin surface -- sales_order already had a rich,
// real state-machine schema (status/payment_status/fulfillment_status CHECK
// constraints) but ZERO admin UI and zero write path anywhere in the app
// (confirmed via full-codebase grep). This is the first real list view.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const status = req.nextUrl.searchParams.get('status');
  const rows = status && status !== 'all'
    ? await query(`SELECT id, order_number, customer_email, status, payment_status, fulfillment_status, total, currency, created_at FROM sales_order WHERE status = $1 ORDER BY created_at DESC LIMIT 200`, [status])
    : await query(`SELECT id, order_number, customer_email, status, payment_status, fulfillment_status, total, currency, created_at FROM sales_order ORDER BY created_at DESC LIMIT 200`);

  return Response.json({
    orders: rows.rows.map((o) => ({
      id: o.id, orderNumber: o.order_number, customerEmail: o.customer_email, status: o.status,
      paymentStatus: o.payment_status, fulfillmentStatus: o.fulfillment_status,
      total: Number(o.total), currency: o.currency, createdAt: o.created_at,
    })),
  });
}
