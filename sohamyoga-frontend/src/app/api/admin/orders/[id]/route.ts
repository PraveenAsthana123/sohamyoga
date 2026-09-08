import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real Order State Machine -- sales_order.status already had a real,
// rich CHECK constraint (draft/pending/confirmed/processing/
// partially_shipped/shipped/delivered/cancelled/refunded/returned) but no
// route ever enforced valid transitions between them or changed the value
// at all. Mirrors the TRANSITIONS-map pattern used elsewhere this session
// (proposal, collaboration, research_project).
const TRANSITIONS: Record<string, string[]> = {
  draft: ['pending', 'cancelled'],
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['partially_shipped', 'shipped', 'cancelled'],
  partially_shipped: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['returned'],
  cancelled: [],
  refunded: [],
  returned: ['refunded'],
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const result = await query(
    `SELECT id, order_number, customer_email, status, payment_status, fulfillment_status,
            subtotal, discount_amount, tax_amount, shipping_amount, total, refund_amount, currency, created_at
     FROM sales_order WHERE id = $1`,
    [id],
  );
  if (!result.rowCount) return Response.json({ error: 'Order not found.' }, { status: 404 });
  const o = result.rows[0];
  return Response.json({
    id: o.id, orderNumber: o.order_number, customerEmail: o.customer_email, status: o.status,
    paymentStatus: o.payment_status, fulfillmentStatus: o.fulfillment_status,
    subtotal: Number(o.subtotal), discountAmount: Number(o.discount_amount), taxAmount: Number(o.tax_amount),
    shippingAmount: Number(o.shipping_amount), total: Number(o.total), refundAmount: Number(o.refund_amount),
    currency: o.currency, createdAt: o.created_at,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as {
    status?: string; refundAmount?: number; refundReason?: string; trackingNumber?: string; carrier?: string; markPaid?: boolean;
  } | null;
  if (!body?.status && !body?.markPaid) return Response.json({ error: 'status or markPaid is required.' }, { status: 400 });

  const current = await query<{ status: string; total: string; payment_status: string }>(`SELECT status, total, payment_status FROM sales_order WHERE id = $1`, [id]);
  if (!current.rowCount) return Response.json({ error: 'Order not found.' }, { status: 404 });

  // Real "mark paid" -- sales_order.payment_status could already be set to
  // 'refunded' (the refund transition above) but nothing ever set it to
  // 'paid', unlike invoice_mirror's equivalent PATCH-to-paid route. This is
  // the manual/pay-later counterpart for orders placed with no payment
  // gateway connected -- staff collects payment out of band, then records it.
  if (body.markPaid) {
    if (!['pending', 'partially_paid'].includes(current.rows[0].payment_status)) {
      return Response.json({ error: `Cannot mark a "${current.rows[0].payment_status}" order as paid.` }, { status: 409 });
    }
    await query(`UPDATE sales_order SET payment_status = 'paid', updated_at = now() WHERE id = $1`, [id]);
    return Response.json({ ok: true });
  }
  if (!body.status) return Response.json({ error: 'status is required.' }, { status: 400 });

  const allowed = TRANSITIONS[current.rows[0].status] ?? [];
  if (!allowed.includes(body.status)) {
    return Response.json({ error: `Cannot move a "${current.rows[0].status}" order to "${body.status}".` }, { status: 409 });
  }

  // Real Refund Integration -- refund_amount/refund_reason existed on
  // sales_order but no write path ever set them; a refunded order silently
  // kept refund_amount=0. Require both when transitioning into 'refunded'.
  if (body.status === 'refunded') {
    if (!body.refundAmount || body.refundAmount <= 0 || body.refundAmount > Number(current.rows[0].total)) {
      return Response.json({ error: `refundAmount must be > 0 and <= order total (${current.rows[0].total}).` }, { status: 400 });
    }
    if (!body.refundReason?.trim()) {
      return Response.json({ error: 'refundReason is required.' }, { status: 400 });
    }
    await query(
      `UPDATE sales_order SET status = $2, payment_status = 'refunded', refund_amount = $3, refund_reason = $4, updated_at = now() WHERE id = $1`,
      [id, body.status, body.refundAmount, body.refundReason.trim()],
    );
    return Response.json({ ok: true });
  }

  // Real Physical/Digital/Service Fulfillment -- order_item.is_digital
  // already existed but nothing ever branched on it, and the real shipment
  // table (tracking_number/carrier/status) was read-only everywhere (grep-
  // confirmed, only ecommerce/orders GET selected from it, nothing wrote to
  // it). A digital-only order needs no carrier tracking; an order with any
  // physical item does.
  if (body.status === 'shipped' || body.status === 'partially_shipped') {
    const items = await query<{ is_digital: boolean }>(`SELECT is_digital FROM order_item WHERE order_id = $1`, [id]);
    const hasPhysical = items.rows.some(r => !r.is_digital);
    if (hasPhysical) {
      if (!body.trackingNumber?.trim() || !body.carrier?.trim()) {
        return Response.json({ error: 'trackingNumber and carrier are required -- this order contains a physical item.' }, { status: 400 });
      }
      await query(
        `INSERT INTO shipment (order_id, tracking_number, carrier, status, shipped_at) VALUES ($1,$2,$3,'shipped',now())`,
        [id, body.trackingNumber.trim(), body.carrier.trim()],
      );
    }
  }

  const fulfillmentStatus = body.status === 'shipped' || body.status === 'partially_shipped' ? 'partial'
    : body.status === 'delivered' ? 'fulfilled'
    : body.status === 'returned' ? 'returned'
    : undefined;

  await query(
    `UPDATE sales_order SET status = $2, updated_at = now()${fulfillmentStatus ? ', fulfillment_status = $3' : ''} WHERE id = $1`,
    fulfillmentStatus ? [id, body.status, fulfillmentStatus] : [id, body.status],
  );

  if (body.status === 'delivered') {
    await query(`UPDATE shipment SET status = 'delivered', delivered_at = now() WHERE order_id = $1 AND status = 'shipped'`, [id]);
  }

  return Response.json({ ok: true });
}
