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
    const carts = await client.query(
      `SELECT * FROM shopify_abandoned_carts WHERE store_domain=$1 ORDER BY created_at DESC LIMIT 100`,
      [params.domain]
    );
    const stats = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE recovered=FALSE) AS open_carts,
        COUNT(*) FILTER (WHERE recovered=TRUE) AS recovered_carts,
        COALESCE(SUM(total_price) FILTER (WHERE recovered=TRUE), 0) AS recovery_revenue
      FROM shopify_abandoned_carts WHERE store_domain=$1
    `, [params.domain]);
    return Response.json({ carts: carts.rows, stats: stats.rows[0] });
  } finally {
    client.release();
  }
}
