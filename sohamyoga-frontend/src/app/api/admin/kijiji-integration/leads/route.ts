import { NextRequest } from 'next/server';
import { getPool } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTable() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS kijiji_leads (
        id SERIAL PRIMARY KEY,
        listing_id INT REFERENCES kijiji_listings(id),
        name TEXT,
        email TEXT,
        phone TEXT,
        message TEXT,
        response_channel TEXT DEFAULT 'email',
        status TEXT DEFAULT 'new',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureTable();

  const url = new URL(req.url);
  const listing_id = url.searchParams.get('listing_id');
  const status = url.searchParams.get('status');

  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (listing_id && listing_id !== 'all') {
    conditions.push(`kl.listing_id = $${idx++}`);
    values.push(Number(listing_id));
  }
  if (status && status !== 'all') {
    conditions.push(`kl.status = $${idx++}`);
    values.push(status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT kl.id, kl.listing_id, kl.name, kl.email, kl.phone, kl.message,
              kl.response_channel, kl.status, kl.created_at,
              li.title AS listing_title
       FROM kijiji_leads kl
       LEFT JOIN kijiji_listings li ON li.id = kl.listing_id
       ${where}
       ORDER BY kl.created_at DESC`,
      values,
    );
    return Response.json({ leads: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureTable();

  const body = await req.json().catch(() => null) as {
    listing_id?: number; name?: string; email?: string; phone?: string;
    message?: string; response_channel?: string;
  } | null;

  if (!body?.listing_id) {
    return Response.json({ error: 'listing_id is required' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    // Increment responses_count on the listing
    await client.query(
      `UPDATE kijiji_listings SET responses_count = responses_count + 1, updated_at = NOW() WHERE id = $1`,
      [body.listing_id],
    );

    const result = await client.query(
      `INSERT INTO kijiji_leads (listing_id, name, email, phone, message, response_channel)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        body.listing_id,
        body.name ?? null,
        body.email ?? null,
        body.phone ?? null,
        body.message ?? null,
        body.response_channel ?? 'email',
      ],
    );
    return Response.json({ lead: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as { id?: number; status?: string } | null;
  if (!body?.id || !body?.status) {
    return Response.json({ error: 'id and status are required' }, { status: 400 });
  }

  const allowed = ['new', 'contacted', 'qualified', 'lost'];
  if (!allowed.includes(body.status)) {
    return Response.json({ error: `status must be one of: ${allowed.join(', ')}` }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE kijiji_leads SET status = $1 WHERE id = $2 RETURNING *`,
      [body.status, body.id],
    );
    if (!result.rowCount) return Response.json({ error: 'Lead not found' }, { status: 404 });
    return Response.json({ lead: result.rows[0] });
  } finally {
    client.release();
  }
}
