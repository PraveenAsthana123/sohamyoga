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
  const search = url.searchParams.get('q') || '';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = 20;
  const offset = (page - 1) * limit;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const whereClause = search
      ? `WHERE store_domain=$1 AND (title ILIKE $4 OR handle ILIKE $4)`
      : `WHERE store_domain=$1`;
    const countValues: unknown[] = search ? [params.domain, limit, offset, `%${search}%`] : [params.domain, limit, offset];
    const countQuery = search
      ? `SELECT COUNT(*) as total FROM shopify_products WHERE store_domain=$1 AND (title ILIKE $2 OR handle ILIKE $2)`
      : `SELECT COUNT(*) as total FROM shopify_products WHERE store_domain=$1`;
    const countParams: unknown[] = search ? [params.domain, `%${search}%`] : [params.domain];

    const [products, total] = await Promise.all([
      client.query(`SELECT * FROM shopify_products ${whereClause} ORDER BY synced_at DESC LIMIT $2 OFFSET $3`, countValues),
      client.query(countQuery, countParams),
    ]);

    return Response.json({
      products: products.rows,
      total: Number(total.rows[0].total),
      page,
      pages: Math.ceil(Number(total.rows[0].total) / limit),
    });
  } finally {
    client.release();
  }
}
