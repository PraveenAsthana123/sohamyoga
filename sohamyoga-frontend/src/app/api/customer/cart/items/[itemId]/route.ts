import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ownsCartItem(itemId: string, customerEmail: string): Promise<string | null> {
  const row = await query<{ order_id: string }>(
    `SELECT oi.order_id FROM order_item oi JOIN sales_order so ON so.id = oi.order_id
     WHERE oi.id = $1 AND so.customer_email = $2 AND so.status = 'draft'`,
    [itemId, customerEmail],
  );
  return row.rows[0]?.order_id ?? null;
}

async function recalcTotals(orderId: string): Promise<void> {
  await query(
    `UPDATE sales_order SET subtotal = COALESCE((SELECT SUM(total_amount) FROM order_item WHERE order_id = $1), 0),
       total = COALESCE((SELECT SUM(total_amount) FROM order_item WHERE order_id = $1), 0), updated_at = now()
     WHERE id = $1`,
    [orderId],
  );
}

// Real Cart Management -- remove/update a line item on the customer's own
// draft-status order (their cart). Ownership-checked the same way as every
// other customer/[id] route this session.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { itemId } = await params;
  const body = await req.json().catch(() => null) as { quantity?: number } | null;
  const quantity = Number(body?.quantity);
  if (!Number.isInteger(quantity) || quantity < 1) return Response.json({ error: 'quantity must be a positive integer.' }, { status: 400 });

  const { principal } = await getCustomerPrincipal(req);
  const customer = await query<{ email: string }>(`SELECT email FROM customer WHERE user_id = $1`, [principal!.id]);
  if (!customer.rowCount) return Response.json({ error: 'No customer record found for this account.' }, { status: 404 });

  const orderId = await ownsCartItem(itemId, customer.rows[0].email);
  if (!orderId) return Response.json({ error: 'Cart item not found.' }, { status: 404 });

  await query(`UPDATE order_item SET quantity = $2, total_amount = $2::int * unit_price WHERE id = $1`, [itemId, quantity]);
  await recalcTotals(orderId);
  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { itemId } = await params;
  const { principal } = await getCustomerPrincipal(req);
  const customer = await query<{ email: string }>(`SELECT email FROM customer WHERE user_id = $1`, [principal!.id]);
  if (!customer.rowCount) return Response.json({ error: 'No customer record found for this account.' }, { status: 404 });

  const orderId = await ownsCartItem(itemId, customer.rows[0].email);
  if (!orderId) return Response.json({ error: 'Cart item not found.' }, { status: 404 });

  await query(`DELETE FROM order_item WHERE id = $1`, [itemId]);
  await recalcTotals(orderId);
  return Response.json({ ok: true });
}
