import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Booking -> Invoice -- mirrors the real Quote/Contract -> Invoice pattern
// (src/app/api/admin/crm/contracts/[id]/generate-invoice). Pre-fills
// amount from the real class_session.price and matches the booking's
// student to a real customer account by email -- honestly errors (never
// fabricates a customer) if no matching account exists yet. Only a
// checked_in booking (service actually delivered) can be invoiced.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const booking = await query<{
    tenant_id: string; status: string; class_name: string; session_date: string; price: string; student_email: string;
  }>(
    `SELECT b.tenant_id, b.status, cs.class_name, cs.session_date, cs.price, s.email AS student_email
     FROM booking b
     JOIN class_session cs ON cs.id = b.class_session_id
     JOIN student s ON s.id = b.student_id
     WHERE b.id = $1`,
    [id],
  );
  if (!booking.rowCount) return Response.json({ error: 'Booking not found.' }, { status: 404 });
  const b = booking.rows[0];

  if (b.status !== 'checked_in') {
    return Response.json({ error: `Only a checked_in booking can be invoiced (this one is "${b.status}").` }, { status: 409 });
  }
  if (Number(b.price) <= 0) {
    return Response.json({ error: 'This class session has no price set -- nothing to invoice.' }, { status: 422 });
  }

  const customer = await query<{ id: string }>(`SELECT id FROM customer WHERE email = $1 AND tenant_id = $2`, [b.student_email, b.tenant_id]);
  if (!customer.rowCount) {
    return Response.json({ error: `No customer account exists yet for ${b.student_email} -- create one before invoicing this booking.` }, { status: 404 });
  }

  const description = `Booking: ${b.class_name} on ${b.session_date}`;
  const existing = await query<{ id: string }>(`SELECT id FROM invoice_mirror WHERE description = $1`, [description]);
  if (existing.rowCount) return Response.json({ error: 'An invoice for this booking already exists.' }, { status: 409 });

  const amount = Number(b.price);
  const tax = Math.round(amount * 0.13 * 100) / 100;
  const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
  const result = await query(
    `INSERT INTO invoice_mirror (tenant_id, customer_id, erpnext_invoice_id, invoice_number, status, amount_cad, tax_cad, total_cad, description)
     VALUES ($1,$2,$3,$4,'submitted',$5,$6,$7,$8) RETURNING *`,
    [b.tenant_id, customer.rows[0].id, `manual-${randomUUID()}`, invoiceNumber, amount, tax, amount + tax, description],
  );
  return Response.json({ invoice: result.rows[0] }, { status: 201 });
}
