import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Quote/Contract -> Invoice -- previously invoice_mirror could only be
// created by an admin manually typing in a customerId + amount from
// scratch, with no link back to the real signed contract it came from.
// This pre-fills amount/description from the real contract and matches the
// contract's lead to a real customer account by email -- honestly errors
// (does not fabricate a customer) if no matching account exists yet.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const contract = await query<{
    tenant_id: string; title: string; amount: string; status: string; lead_email: string | null;
  }>(
    `SELECT c.tenant_id, c.title, c.amount, c.status, l.email AS lead_email
     FROM contract c JOIN campaign_lead l ON l.id = c.lead_id
     WHERE c.id = $1`,
    [id],
  );
  if (!contract.rowCount) return Response.json({ error: 'Contract not found.' }, { status: 404 });
  const c = contract.rows[0];

  if (c.status !== 'signed') {
    return Response.json({ error: `Only a signed contract can be invoiced (this one is "${c.status}").` }, { status: 409 });
  }
  if (!c.lead_email) return Response.json({ error: 'This contract\'s lead has no email on file.' }, { status: 422 });

  const customer = await query<{ id: string }>(`SELECT id FROM customer WHERE email = $1 AND tenant_id = $2`, [c.lead_email, c.tenant_id]);
  if (!customer.rowCount) {
    return Response.json({ error: `No customer account exists yet for ${c.lead_email} -- create one before invoicing this contract.` }, { status: 404 });
  }

  const existing = await query<{ id: string }>(`SELECT id FROM invoice_mirror WHERE description = $1`, [`Contract: ${c.title}`]);
  if (existing.rowCount) return Response.json({ error: 'An invoice for this contract already exists.' }, { status: 409 });

  const amount = Number(c.amount);
  const tax = Math.round(amount * 0.13 * 100) / 100;
  const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
  const result = await query(
    `INSERT INTO invoice_mirror (tenant_id, customer_id, erpnext_invoice_id, invoice_number, status, amount_cad, tax_cad, total_cad, description)
     VALUES ($1,$2,$3,$4,'submitted',$5,$6,$7,$8) RETURNING *`,
    [c.tenant_id, customer.rows[0].id, `manual-${randomUUID()}`, invoiceNumber, amount, tax, amount + tax, `Contract: ${c.title}`],
  );
  return Response.json({ invoice: result.rows[0] }, { status: 201 });
}
