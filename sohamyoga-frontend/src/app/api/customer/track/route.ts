import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ENSURE_TABLE = `
  CREATE TABLE IF NOT EXISTS customer_event (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT,
    customer_id INTEGER REFERENCES customer(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    page_path TEXT,
    element_id TEXT,
    metadata JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`;

export async function POST(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ ok: true }); // silently drop if no DB

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid body.' }, { status: 400 });

  const { event_type, page_path, element_id, metadata } = body as Record<string, unknown>;
  if (typeof event_type !== 'string' || !event_type.trim()) {
    return Response.json({ error: 'event_type is required.' }, { status: 400 });
  }

  const sessionId = req.cookies.get('session_id')?.value ?? null;
  const customerIdRaw = req.cookies.get('customer_id')?.value;
  const customerId = customerIdRaw ? parseInt(customerIdRaw, 10) : null;
  const ipAddress =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    null;
  const userAgent = req.headers.get('user-agent') ?? null;

  await query(ENSURE_TABLE);
  await query(
    `INSERT INTO customer_event (session_id, customer_id, event_type, page_path, element_id, metadata, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      sessionId,
      Number.isFinite(customerId) ? customerId : null,
      event_type.trim(),
      typeof page_path === 'string' ? page_path : null,
      typeof element_id === 'string' ? element_id : null,
      metadata != null ? JSON.stringify(metadata) : null,
      ipAddress,
      userAgent,
    ],
  ).catch(() => {}); // fire-and-forget — never fail a page load because of tracking

  return Response.json({ ok: true });
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  await query(ENSURE_TABLE);

  const url = new URL(req.url);
  const eventTypeFilter = url.searchParams.get('event_type');
  const pagePathFilter = url.searchParams.get('page_path');

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (eventTypeFilter) {
    params.push(eventTypeFilter);
    conditions.push(`event_type = $${params.length}`);
  }
  if (pagePathFilter) {
    params.push(pagePathFilter);
    conditions.push(`page_path = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT id, session_id, customer_id, event_type, page_path, element_id, metadata, ip_address, user_agent, created_at
     FROM customer_event ${where} ORDER BY created_at DESC LIMIT 100`,
    params,
  ).catch(() => ({ rows: [] }));

  return Response.json({ events: result.rows });
}
