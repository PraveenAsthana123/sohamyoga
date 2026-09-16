export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function GET(req: NextRequest, { params }: { params: { domain: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  const url = new URL(req.url);
  const status = url.searchParams.get('status') || '';

  const pool = getPool();
  const client = await pool.connect();
  try {
    let sql = `SELECT * FROM shopify_orders WHERE store_domain=$1`;
    const values: unknown[] = [params.domain];
    if (status) {
      sql += ` AND status=$2`;
      values.push(status);
    }
    sql += ` ORDER BY created_at DESC LIMIT 100`;
    const orders = await client.query(sql, values);
    return Response.json({ orders: orders.rows });
  } finally {
    client.release();
  }
}
