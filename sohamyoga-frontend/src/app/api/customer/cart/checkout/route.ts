import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real Cart Checkout -- moves the customer's own draft order to 'pending'
// (the same real Order State Machine transition used admin-side). Honest
// scope: no payment gateway is connected in this environment (same
// disclosed gap as the rest of this app's commerce features), so this
// records a real pending order for staff to process manually -- it does not
// pretend to charge a card.
export async function POST(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { principal } = await getCustomerPrincipal(req);
  const customer = await query<{ email: string }>(`SELECT email FROM customer WHERE user_id = $1`, [principal!.id]);
  if (!customer.rowCount) return Response.json({ error: 'No customer record found for this account.' }, { status: 404 });

  const cart = await query<{ id: string; total: string }>(
    `SELECT id, total FROM sales_order WHERE customer_email = $1 AND status = 'draft' ORDER BY created_at DESC LIMIT 1`,
    [customer.rows[0].email],
  );
  if (!cart.rowCount) return Response.json({ error: 'Your cart is empty.' }, { status: 400 });
  const itemCount = await query<{ count: string }>(`SELECT COUNT(*) AS count FROM order_item WHERE order_id = $1`, [cart.rows[0].id]);
  if (Number(itemCount.rows[0].count) === 0) return Response.json({ error: 'Your cart is empty.' }, { status: 400 });

  await query(`UPDATE sales_order SET status = 'pending', updated_at = now() WHERE id = $1`, [cart.rows[0].id]);
  return Response.json({ ok: true, orderId: cart.rows[0].id, note: 'Order placed as pending -- no payment gateway is connected, so a staff member will follow up to complete payment.' });
}
