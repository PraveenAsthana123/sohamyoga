import { NextRequest } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface InvoiceRow {
  invoice_number: string; status: string; amount_cad: string; tax_cad: string; total_cad: string;
  description: string | null; due_date: string | null; paid_at: string | null; synced_at: string;
}

// Real PDF generated from the same invoice_mirror row the customer sees in
// /customer/invoices -- pdf-lib renders a real PDF byte stream, not a
// screenshot or fabricated document.
export async function GET(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return Response.json({ error: 'id query param is required.' }, { status: 400 });

  const { principal } = await getCustomerPrincipal(req);
  const customer = await query<{ id: string; display_name: string; email: string }>(
    `SELECT id, display_name, email FROM customer WHERE user_id = $1`, [principal!.id],
  );
  if (!customer.rowCount) return Response.json({ error: 'No customer record found.' }, { status: 404 });

  const invoice = await query<InvoiceRow>(
    `SELECT invoice_number, status, amount_cad, tax_cad, total_cad, description, due_date::text AS due_date, paid_at::text AS paid_at, synced_at::text AS synced_at
     FROM invoice_mirror WHERE id = $1 AND customer_id = $2`,
    [id, customer.rows[0].id],
  );
  if (!invoice.rowCount) return Response.json({ error: 'Invoice not found.' }, { status: 404 });
  const inv = invoice.rows[0];

  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = 780;
  const draw = (text: string, opts: { size?: number; f?: typeof font; x?: number } = {}) => {
    page.drawText(text, { x: opts.x ?? 50, y, size: opts.size ?? 11, font: opts.f ?? font, color: rgb(0.1, 0.1, 0.1) });
    y -= (opts.size ?? 11) + 10;
  };

  draw('SohamYoga', { size: 22, f: bold });
  draw(`Invoice ${inv.invoice_number}`, { size: 14, f: bold });
  y -= 10;
  draw(`Billed to: ${customer.rows[0].display_name} (${customer.rows[0].email})`);
  draw(`Status: ${inv.status}`);
  if (inv.due_date) draw(`Due date: ${inv.due_date}`);
  if (inv.paid_at) draw(`Paid at: ${new Date(inv.paid_at).toISOString().slice(0, 10)}`);
  y -= 10;
  if (inv.description) draw(`Description: ${inv.description}`);
  y -= 10;
  draw(`Subtotal: CAD $${inv.amount_cad}`);
  draw(`Tax: CAD $${inv.tax_cad}`);
  draw(`Total: CAD $${inv.total_cad}`, { size: 13, f: bold });
  y -= 20;
  draw(`Synced from billing system: ${new Date(inv.synced_at).toISOString()}`, { size: 9 });

  const bytes = await doc.save();
  return new Response(Buffer.from(bytes), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="invoice-${inv.invoice_number}.pdf"` },
  });
}
