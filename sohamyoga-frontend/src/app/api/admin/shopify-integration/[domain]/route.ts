export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function GET(req: NextRequest, { params }: { params: { domain: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const conn = await client.query(`SELECT * FROM shopify_connections WHERE store_domain=$1`, [params.domain]);
    if (conn.rowCount === 0) return Response.json({ error: 'Connection not found.' }, { status: 404 });
    return Response.json({ connection: conn.rows[0] });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { domain: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: 'Invalid request.' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (typeof body.shop_name === 'string') { fields.push(`shop_name=$${idx++}`); values.push(body.shop_name); }
    if (typeof body.plan === 'string') { fields.push(`plan=$${idx++}`); values.push(body.plan); }
    if (typeof body.status === 'string') { fields.push(`status=$${idx++}`); values.push(body.status); }
    if (typeof body.access_token === 'string') { fields.push(`access_token=$${idx++}`); values.push(body.access_token); }
    if (fields.length === 0) return Response.json({ error: 'Nothing to update.' }, { status: 400 });
    values.push(params.domain);
    const result = await client.query(
      `UPDATE shopify_connections SET ${fields.join(',')} WHERE store_domain=$${idx} RETURNING *`,
      values
    );
    if (result.rowCount === 0) return Response.json({ error: 'Connection not found.' }, { status: 404 });
    return Response.json({ connection: result.rows[0] });
  } finally {
    client.release();
  }
}
