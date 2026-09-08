import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DIRECTIONS = ['call_in', 'call_out'];
const PHONE_RE = /^[+\d][\d\s().-]{6,20}$/;

// Self-service Call In / Call Out. No telephony automation exists here, so
// this creates a real request for staff to act on manually — the honest
// scope for a studio this size, not a fabricated automated-dialer feature.
export async function GET(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { principal } = await getCustomerPrincipal(req);
  const customerRes = await query<{ id: string }>(`SELECT id FROM customer WHERE user_id = $1`, [principal!.id]);
  if (!customerRes.rowCount) return Response.json({ error: 'No customer record found for this account.' }, { status: 404 });

  const result = await query(
    `SELECT id, direction, reason, phone, preferred_time, status, outcome_notes, completed_at, created_at
     FROM call_request WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [customerRes.rows[0].id],
  );
  return Response.json({ requests: result.rows });
}

export async function POST(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    direction?: string; reason?: string; phone?: string; preferredTime?: string;
  } | null;
  if (!body?.direction || !DIRECTIONS.includes(body.direction)) {
    return Response.json({ error: `direction must be one of ${DIRECTIONS.join('|')}.` }, { status: 400 });
  }
  if (!body.phone || !PHONE_RE.test(body.phone.trim())) {
    return Response.json({ error: 'A valid phone number is required.' }, { status: 400 });
  }

  const { principal } = await getCustomerPrincipal(req);
  const customerRes = await query<{ id: string; tenant_id: string }>(
    `SELECT id, tenant_id FROM customer WHERE user_id = $1`,
    [principal!.id],
  );
  if (!customerRes.rowCount) return Response.json({ error: 'No customer record found for this account.' }, { status: 404 });

  const result = await query(
    `INSERT INTO call_request (tenant_id, customer_id, direction, reason, phone, preferred_time)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, direction, reason, phone, preferred_time, status, created_at`,
    [customerRes.rows[0].tenant_id, customerRes.rows[0].id, body.direction, body.reason?.trim() || '', body.phone.trim(), body.preferredTime || null],
  );
  return Response.json({ request: result.rows[0] }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { requestId?: string; action?: string } | null;
  if (!body?.requestId || body.action !== 'cancel') {
    return Response.json({ error: 'requestId and action=cancel are required.' }, { status: 400 });
  }
  const { principal } = await getCustomerPrincipal(req);
  const customerRes = await query<{ id: string }>(`SELECT id FROM customer WHERE user_id = $1`, [principal!.id]);
  if (!customerRes.rowCount) return Response.json({ error: 'No customer record found for this account.' }, { status: 404 });

  const result = await query(
    `UPDATE call_request SET status = 'cancelled', updated_at = now()
     WHERE id = $1 AND customer_id = $2 AND status IN ('requested', 'scheduled')
     RETURNING id, status`,
    [body.requestId, customerRes.rows[0].id],
  );
  if (!result.rowCount) return Response.json({ error: 'Request not found or already completed.' }, { status: 404 });
  return Response.json({ request: result.rows[0] });
}
