import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CATEGORIES = ['billing', 'class_change', 'complaint', 'health_concern', 'general', 'technical'];

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

  const tickets = await query(
    `SELECT id, subject, category, priority, status, first_response_at, resolved_at, csat_score, created_at
     FROM support_ticket WHERE customer_id = $1 ORDER BY created_at DESC`,
    [customer.id],
  );
  return Response.json({ tickets: tickets.rows, categories: CATEGORIES });
}

export async function POST(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { subject?: string; category?: string } | null;
  if (!body?.subject?.trim() || !body.category || !CATEGORIES.includes(body.category)) {
    return Response.json({ error: `subject and a valid category (${CATEGORIES.join('|')}) are required.` }, { status: 400 });
  }

  const { principal } = await getCustomerPrincipal(req);
  const customer = await resolveCustomer(principal!.id);
  if (!customer) return Response.json({ error: 'No customer record found for this account.' }, { status: 404 });

  const result = await query(
    `INSERT INTO support_ticket (tenant_id, customer_id, subject, category) VALUES ($1,$2,$3,$4) RETURNING *`,
    [customer.tenant_id, customer.id, body.subject.trim(), body.category],
  );
  return Response.json({ ticket: result.rows[0] }, { status: 201 });
}
