import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real, read-only view of invoice_mirror -- a read copy synced from ERPNext.
// No writes happen from this app; an honestly empty list means no invoice
// has ever synced for this customer, not a broken page.
export async function GET(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { principal } = await getCustomerPrincipal(req);
  const customer = await query<{ id: string }>(`SELECT id FROM customer WHERE user_id = $1`, [principal!.id]);
  if (!customer.rowCount) return Response.json({ error: 'No customer record found for this account.' }, { status: 404 });

  const invoices = await query(
    `SELECT id, invoice_number, status, amount_cad, tax_cad, total_cad, description, due_date, paid_at, synced_at
     FROM invoice_mirror WHERE customer_id = $1 ORDER BY due_date DESC NULLS LAST, synced_at DESC`,
    [customer.rows[0].id],
  );
  return Response.json({ invoices: invoices.rows });
}
