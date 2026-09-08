import { NextRequest } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real Exchange Management -- a returned order could previously only be
// refunded (money back); there was no way to swap it for a replacement item.
// Only a 'returned' order can be exchanged. Creates a real new sales_order
// (linked via exchange_for_order_id) for the replacement item and marks the
// original 'exchanged' -- a distinct terminal state from 'refunded'.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as {
    replacementProductName?: string; replacementSku?: string; replacementUnitPrice?: number;
  } | null;
  if (!body?.replacementProductName?.trim() || !body.replacementSku?.trim() || body.replacementUnitPrice === undefined || body.replacementUnitPrice < 0) {
    return Response.json({ error: 'replacementProductName, replacementSku, and a non-negative replacementUnitPrice are required.' }, { status: 400 });
  }

  const original = await query<{ status: string; customer_email: string; currency: string }>(
    `SELECT status, customer_email, currency FROM sales_order WHERE id = $1`, [id],
  );
  if (!original.rowCount) return Response.json({ error: 'Order not found.' }, { status: 404 });
  if (original.rows[0].status !== 'returned') {
    return Response.json({ error: `Only a "returned" order can be exchanged (this one is "${original.rows[0].status}").` }, { status: 409 });
  }
  const o = original.rows[0];

  const orderNumber = `EXCH-${id.slice(0, 8).toUpperCase()}`;
  const replacement = await query<{ id: string }>(
    `INSERT INTO sales_order (order_number, customer_email, status, subtotal, total, currency, notes)
     VALUES ($1,$2,'pending',$3,$3,$4,$5) RETURNING id`,
    [orderNumber, o.customer_email, body.replacementUnitPrice, o.currency, `Exchange for order ${id}`],
  );
  const replacementId = replacement.rows[0].id;

  await query(
    `INSERT INTO order_item (order_id, product_id, product_name, product_type, sku, quantity, unit_price, total_amount)
     VALUES ($1,$2,$3,'physical',$4,1,$5,$5)`,
    [replacementId, `exchange-${id.slice(0, 8)}`, body.replacementProductName.trim(), body.replacementSku.trim(), body.replacementUnitPrice],
  );

  await query(
    `UPDATE sales_order SET status = 'exchanged', exchange_for_order_id = $2, updated_at = now(), internal_notes = COALESCE(internal_notes || E'\\n', '') || $3 WHERE id = $1`,
    [id, replacementId, `Exchanged by ${principal!.email ?? principal!.id} -> order ${replacementId}`],
  );

  return Response.json({ ok: true, replacementOrderId: replacementId }, { status: 201 });
}
