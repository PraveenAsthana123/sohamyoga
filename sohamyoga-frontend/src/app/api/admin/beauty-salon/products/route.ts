import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        SELECT *, (stock_quantity <= reorder_level) AS low_stock
        FROM salon_product ORDER BY (stock_quantity <= reorder_level) DESC, name
      `);
      return Response.json({ products: rows });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { name, brand, category, sku, cost_price, retail_price, stock_quantity = 0, reorder_level = 5 } = body;
    if (!name) return Response.json({ error: 'name required' }, { status: 400 });
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO salon_product (name,brand,category,sku,cost_price,retail_price,stock_quantity,reorder_level)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [name, brand ?? null, category ?? null, sku ?? null, cost_price ?? null, retail_price ?? null, stock_quantity, reorder_level]
      );
      return Response.json({ product: rows[0] }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
