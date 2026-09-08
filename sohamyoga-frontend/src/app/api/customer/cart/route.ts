import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real Cart Management -- reuses sales_order's own real 'draft' status
// (already in the CHECK constraint enforced by the Order State Machine)
// rather than inventing a parallel cart table. abandoned_cart_recovery even
// already assumes this design (its order_id FK requires a real sales_order
// to exist). A cart IS a draft order; checkout is draft -> pending.
async function findOrCreateCart(customerEmail: string): Promise<string> {
  const existing = await query<{ id: string }>(
    `SELECT id FROM sales_order WHERE customer_email = $1 AND status = 'draft' ORDER BY created_at DESC LIMIT 1`,
    [customerEmail],
  );
  if (existing.rowCount) return existing.rows[0].id;
  const created = await query<{ id: string }>(
    `INSERT INTO sales_order (order_number, customer_email, status, subtotal, total)
     VALUES ($1,$2,'draft',0,0) RETURNING id`,
    [`CART-${Date.now().toString(36).toUpperCase()}`, customerEmail],
  );
  return created.rows[0].id;
}

async function recalcTotals(orderId: string): Promise<void> {
  await query(
    `UPDATE sales_order SET subtotal = COALESCE((SELECT SUM(total_amount) FROM order_item WHERE order_id = $1), 0),
       total = COALESCE((SELECT SUM(total_amount) FROM order_item WHERE order_id = $1), 0), updated_at = now()
     WHERE id = $1`,
    [orderId],
  );
}

export async function GET(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { principal } = await getCustomerPrincipal(req);
  const customer = await query<{ email: string }>(`SELECT email FROM customer WHERE user_id = $1`, [principal!.id]);
  if (!customer.rowCount) return Response.json({ error: 'No customer record found for this account.' }, { status: 404 });

  const cart = await query<{ id: string; subtotal: string; total: string }>(
    `SELECT id, subtotal, total FROM sales_order WHERE customer_email = $1 AND status = 'draft' ORDER BY created_at DESC LIMIT 1`,
    [customer.rows[0].email],
  );
  if (!cart.rowCount) return Response.json({ cartId: null, items: [], subtotal: 0, total: 0 });

  const items = await query(
    `SELECT id, product_id, product_name, sku, quantity, unit_price, total_amount FROM order_item WHERE order_id = $1`,
    [cart.rows[0].id],
  );
  return Response.json({
    cartId: cart.rows[0].id, subtotal: Number(cart.rows[0].subtotal), total: Number(cart.rows[0].total),
    items: items.rows.map(i => ({ id: i.id, productId: i.product_id, productName: i.product_name, sku: i.sku, quantity: i.quantity, unitPrice: Number(i.unit_price), totalAmount: Number(i.total_amount) })),
  });
}

export async function POST(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { productId?: string; quantity?: number } | null;
  const quantity = Number(body?.quantity ?? 1);
  if (!body?.productId || !Number.isInteger(quantity) || quantity < 1) {
    return Response.json({ error: 'productId and a positive integer quantity are required.' }, { status: 400 });
  }

  const { principal } = await getCustomerPrincipal(req);
  const customer = await query<{ email: string }>(`SELECT email FROM customer WHERE user_id = $1`, [principal!.id]);
  if (!customer.rowCount) return Response.json({ error: 'No customer record found for this account.' }, { status: 404 });

  const product = await query<{ id: string; name: string; sku: string; base_price: string; product_type: string; is_digital: boolean | null }>(
    `SELECT id, name, sku, base_price, product_type FROM product_master WHERE id = $1 AND status = 'active'`,
    [body.productId],
  );
  if (!product.rowCount) return Response.json({ error: 'Product not found or not available for sale.' }, { status: 404 });
  const p = product.rows[0];

  const cartId = await findOrCreateCart(customer.rows[0].email);
  const existingItem = await query<{ id: string; quantity: number }>(
    `SELECT id, quantity FROM order_item WHERE order_id = $1 AND product_id = $2`,
    [cartId, p.id],
  );
  if (existingItem.rowCount) {
    const newQty = existingItem.rows[0].quantity + quantity;
    await query(
      `UPDATE order_item SET quantity = $2, total_amount = $2::int * unit_price WHERE id = $1`,
      [existingItem.rows[0].id, newQty],
    );
  } else {
    const totalAmount = quantity * Number(p.base_price);
    await query(
      `INSERT INTO order_item (order_id, product_id, product_name, product_type, sku, quantity, unit_price, total_amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [cartId, p.id, p.name, p.product_type, p.sku, quantity, p.base_price, totalAmount],
    );
  }
  await recalcTotals(cartId);

  return Response.json({ ok: true, cartId }, { status: 201 });
}
