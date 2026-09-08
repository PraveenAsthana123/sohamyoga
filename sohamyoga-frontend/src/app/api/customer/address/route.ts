import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveCustomer(userId: string) {
  const res = await query<{ id: string; tenant_id: string }>(`SELECT id, tenant_id FROM customer WHERE user_id = $1`, [userId]);
  return res.rows[0] ?? null;
}

export async function GET(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { principal } = await getCustomerPrincipal(req);
  const customer = await resolveCustomer(principal!.id);
  if (!customer) return Response.json({ error: 'No customer record found for this account.' }, { status: 404 });

  const addresses = await query(`SELECT * FROM customer_address WHERE customer_id = $1 ORDER BY created_at`, [customer.id]);
  return Response.json({ addresses: addresses.rows });
}

export async function POST(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    label?: string; line1?: string; line2?: string; city?: string; state?: string; postalCode?: string; country?: string;
  } | null;
  if (!body?.line1 || !body.city) {
    return Response.json({ error: 'line1 and city are required.' }, { status: 400 });
  }
  const country = (body.country || 'CA').slice(0, 2).toUpperCase();

  const { principal } = await getCustomerPrincipal(req);
  const customer = await resolveCustomer(principal!.id);
  if (!customer) return Response.json({ error: 'No customer record found for this account.' }, { status: 404 });

  const result = await query(
    `INSERT INTO customer_address (customer_id, tenant_id, label, line1, line2, city, state, postal_code, country)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [customer.id, customer.tenant_id, body.label || 'Home', body.line1, body.line2 || null, body.city, body.state || null, body.postalCode || null, country],
  );
  return Response.json({ address: result.rows[0] }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const addressId = req.nextUrl.searchParams.get('id');
  if (!addressId) return Response.json({ error: 'id query param is required.' }, { status: 400 });

  const { principal } = await getCustomerPrincipal(req);
  const customer = await resolveCustomer(principal!.id);
  if (!customer) return Response.json({ error: 'No customer record found for this account.' }, { status: 404 });

  const result = await query(`DELETE FROM customer_address WHERE id = $1 AND customer_id = $2`, [addressId, customer.id]);
  if (!result.rowCount) return Response.json({ error: 'Address not found.' }, { status: 404 });
  return Response.json({ ok: true });
}
