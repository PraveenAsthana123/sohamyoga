import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real Customer Self-Service — Order Detail. Same ownership check pattern as
// other customer/[id] routes in this app: the row must belong to THIS
// customer's own email, or it 404s -- never leaks another customer's order.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const { principal } = await getCustomerPrincipal(req);
  const customer = await query<{ email: string }>(`SELECT email FROM customer WHERE user_id = $1`, [principal!.id]);
  if (!customer.rowCount) return Response.json({ error: 'No customer record found for this account.' }, { status: 404 });

  const order = await query(
    `SELECT id, order_number, status, payment_status, fulfillment_status, subtotal, discount_amount, tax_amount,
            shipping_amount, total, currency, refund_amount, refund_reason, created_at
     FROM sales_order WHERE id = $1 AND customer_email = $2`,
    [id, customer.rows[0].email],
  );
  if (!order.rowCount) return Response.json({ error: 'Order not found.' }, { status: 404 });
  const o = order.rows[0];

  const [items, shipments] = await Promise.all([
    query(`SELECT product_name, sku, quantity, unit_price, total_amount, is_digital, download_url FROM order_item WHERE order_id = $1`, [id]),
    query(`SELECT tracking_number, carrier, status, shipped_at, delivered_at FROM shipment WHERE order_id = $1 ORDER BY created_at`, [id]),
  ]);

  return Response.json({
    id: o.id, orderNumber: o.order_number, status: o.status, paymentStatus: o.payment_status,
    fulfillmentStatus: o.fulfillment_status, subtotal: Number(o.subtotal), discountAmount: Number(o.discount_amount),
    taxAmount: Number(o.tax_amount), shippingAmount: Number(o.shipping_amount), total: Number(o.total),
    currency: o.currency, refundAmount: Number(o.refund_amount), refundReason: o.refund_reason, createdAt: o.created_at,
    items: items.rows.map(i => ({
      productName: i.product_name, sku: i.sku, quantity: i.quantity, unitPrice: Number(i.unit_price),
      totalAmount: Number(i.total_amount), isDigital: i.is_digital, downloadUrl: i.is_digital ? i.download_url : undefined,
    })),
    shipments: shipments.rows.map(s => ({
      trackingNumber: s.tracking_number, carrier: s.carrier, status: s.status, shippedAt: s.shipped_at, deliveredAt: s.delivered_at,
    })),
  });
}
