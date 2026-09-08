import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real Booking -> Order -- mirrors the Booking -> Invoice pattern
// (src/app/api/admin/bookings/[id]/generate-invoice), but into the ORDER
// MANAGEMENT domain's sales_order/order_item pipeline rather than billing's
// invoice_mirror. sales_order was never populated by any real code path
// before this session (see Quote -> Order); this is a second real writer,
// for service bookings specifically. Only a checked_in booking (service
// actually delivered) can be converted.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const booking = await query<{ status: string; class_name: string; session_date: string; price: string; student_email: string }>(
    `SELECT b.status, cs.class_name, cs.session_date, cs.price, s.email AS student_email
     FROM booking b
     JOIN class_session cs ON cs.id = b.class_session_id
     JOIN student s ON s.id = b.student_id
     WHERE b.id = $1`,
    [id],
  );
  if (!booking.rowCount) return Response.json({ error: 'Booking not found.' }, { status: 404 });
  const b = booking.rows[0];

  if (b.status !== 'checked_in') {
    return Response.json({ error: `Only a checked_in booking can be converted to an order (this one is "${b.status}").` }, { status: 409 });
  }
  if (Number(b.price) <= 0) {
    return Response.json({ error: 'This class session has no price set -- nothing to order.' }, { status: 422 });
  }

  const orderNumber = `BOOK-${id.slice(0, 8).toUpperCase()}`;
  const existing = await query<{ id: string }>(`SELECT id FROM sales_order WHERE order_number = $1`, [orderNumber]);
  if (existing.rowCount) return Response.json({ error: 'An order for this booking already exists.', orderId: existing.rows[0].id }, { status: 409 });

  const amount = Number(b.price);
  const order = await query<{ id: string }>(
    `INSERT INTO sales_order (order_number, customer_email, status, subtotal, total, notes)
     VALUES ($1,$2,'delivered',$3,$3,$4) RETURNING id`,
    [orderNumber, b.student_email, amount, `Booking: ${b.class_name} on ${b.session_date}`],
  );
  const orderId = order.rows[0].id;

  await query(
    `INSERT INTO order_item (order_id, product_id, product_name, product_type, sku, quantity, unit_price, total_amount)
     VALUES ($1,$2,$3,'service',$4,1,$5,$5)`,
    [orderId, id, b.class_name, `BOOKING-${id.slice(0, 8)}`, amount],
  );

  return Response.json({ ok: true, orderId }, { status: 201 });
}
