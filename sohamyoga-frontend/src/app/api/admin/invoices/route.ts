import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUSES = ['draft', 'submitted', 'paid', 'overdue', 'cancelled'];

// Real admin billing management for invoice_mirror. Previously zero admin
// surface existed anywhere for this table, and no real ERPNext sync job
// exists in this codebase despite the schema comment claiming one -- so
// this is, honestly, the ONLY real way invoices get created today (found
// live during the 2026-09-01 admin-panel gap audit).
export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const invoices = await query(
    `SELECT im.id, im.customer_id, c.display_name AS customer_name, im.invoice_number, im.status,
            im.amount_cad, im.tax_cad, im.total_cad, im.description, im.due_date, im.paid_at, im.synced_at
     FROM invoice_mirror im JOIN customer c ON c.id = im.customer_id
     ORDER BY im.due_date DESC NULLS LAST, im.synced_at DESC LIMIT 500`,
  );
  return Response.json({ invoices: invoices.rows });
}

export async function POST(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    customerId?: string; amountCad?: number; taxCad?: number; description?: string; dueDate?: string;
  } | null;
  if (!body?.customerId || body.amountCad === undefined) {
    return Response.json({ error: 'customerId and amountCad are required.' }, { status: 400 });
  }

  const customer = await query<{ tenant_id: string }>(`SELECT tenant_id FROM customer WHERE id = $1`, [body.customerId]);
  if (!customer.rowCount) return Response.json({ error: 'Customer not found.' }, { status: 404 });

  const tax = body.taxCad ?? Math.round(body.amountCad * 0.13 * 100) / 100;
  const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
  const result = await query(
    `INSERT INTO invoice_mirror (tenant_id, customer_id, erpnext_invoice_id, invoice_number, status, amount_cad, tax_cad, total_cad, description, due_date)
     VALUES ($1,$2,$3,$4,'submitted',$5,$6,$7,$8,$9) RETURNING *`,
    [customer.rows[0].tenant_id, body.customerId, `manual-${randomUUID()}`, invoiceNumber, body.amountCad, tax, body.amountCad + tax, body.description || null, body.dueDate || null],
  );
  return Response.json({ invoice: result.rows[0] }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { id?: string; status?: string } | null;
  if (!body?.id || !body.status || !STATUSES.includes(body.status)) {
    return Response.json({ error: `id and a valid status (${STATUSES.join('|')}) are required.` }, { status: 400 });
  }
  const paidAt = body.status === 'paid' ? new Date().toISOString() : null;
  const result = await query(
    `UPDATE invoice_mirror SET status = $1, paid_at = COALESCE($2, paid_at), synced_at = now() WHERE id = $3 RETURNING *`,
    [body.status, paidAt, body.id],
  );
  if (!result.rowCount) return Response.json({ error: 'Invoice not found.' }, { status: 404 });
  return Response.json({ invoice: result.rows[0] });
}
