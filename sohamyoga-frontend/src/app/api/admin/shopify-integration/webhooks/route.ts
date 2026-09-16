export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  const url = new URL(req.url);
  const domain = url.searchParams.get('domain') || '';

  const pool = getPool();
  const client = await pool.connect();
  try {
    let sql = `SELECT * FROM shopify_webhooks`;
    const values: unknown[] = [];
    if (domain) { sql += ` WHERE store_domain=$1`; values.push(domain); }
    sql += ` ORDER BY created_at DESC`;
    const webhooks = await client.query(sql, values);
    return Response.json({ webhooks: webhooks.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  const body = await req.json().catch(() => null);
  if (!body || !body.store_domain || !body.topic || !body.endpoint) {
    return Response.json({ error: 'store_domain, topic, and endpoint are required.' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(`
      INSERT INTO shopify_webhooks(store_domain, topic, endpoint, status)
      VALUES($1,$2,$3,$4)
      RETURNING *
    `, [body.store_domain, body.topic, body.endpoint, body.status || 'active']);
    return Response.json({ webhook: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  const body = await req.json().catch(() => null);
  if (!body || !body.id || !body.status) return Response.json({ error: 'id and status required.' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE shopify_webhooks SET status=$1 WHERE id=$2 RETURNING *`,
      [body.status, body.id]
    );
    if (result.rowCount === 0) return Response.json({ error: 'Webhook not found.' }, { status: 404 });
    return Response.json({ webhook: result.rows[0] });
  } finally {
    client.release();
  }
}
