import { attachAffiliate, AFFILIATE_COOKIE } from '@/domain/referral/AffiliateLedger';
import { NextRequest } from 'next/server';
import { databaseConfigured, query, transaction } from '@/lib/postgres';
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

  return transaction(async client => {
    const cart = await client.query<{id:string}>(
      `SELECT id FROM sales_order WHERE customer_email=$1 AND status='draft'
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [customer.rows[0].email]);
    if (!cart.rowCount) return Response.json({error:'Your cart is empty.'},{status:400});
    const orderId=cart.rows[0].id;
    const items=await client.query('SELECT id FROM order_item WHERE order_id=$1',[orderId]);
    if (!items.rowCount) return Response.json({error:'Your cart is empty.'},{status:400});
    await attachAffiliate(client,orderId,req.cookies.get(AFFILIATE_COOKIE)?.value);
    await client.query("UPDATE sales_order SET status='pending',updated_at=now() WHERE id=$1",[orderId]);
    return Response.json({ok:true,orderId,note:'Order placed as pending. Staff must confirm payment; no payment was charged.'});
  });
}
