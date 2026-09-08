import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real Customer Self-Service — Order Management. sales_order/order_item had
// real admin-side writers (Quote->Order, Booking->Order) but zero
// customer-facing read path -- a customer had no way to see their own real
// orders. Matched by email (sales_order.customer_id has no FK; email is the
// real join key both writers use).
export async function GET(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { principal } = await getCustomerPrincipal(req);
  const customer = await query<{ email: string }>(`SELECT email FROM customer WHERE user_id = $1`, [principal!.id]);
  if (!customer.rowCount) return Response.json({ error: 'No customer record found for this account.' }, { status: 404 });

  const orders = await query(
    `SELECT o.id, o.order_number, o.status, o.payment_status, o.fulfillment_status, o.total, o.currency, o.created_at,
            (SELECT COUNT(*) FROM order_item WHERE order_id = o.id) AS item_count,
            (SELECT tracking_number FROM shipment WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1) AS tracking_number
     FROM sales_order o WHERE o.customer_email = $1 ORDER BY o.created_at DESC`,
    [customer.rows[0].email],
  );

  return Response.json({
    orders: orders.rows.map(o => ({
      id: o.id, orderNumber: o.order_number, status: o.status, paymentStatus: o.payment_status,
      fulfillmentStatus: o.fulfillment_status, total: Number(o.total), currency: o.currency,
      createdAt: o.created_at, itemCount: Number(o.item_count), trackingNumber: o.tracking_number ?? undefined,
    })),
  });
}
