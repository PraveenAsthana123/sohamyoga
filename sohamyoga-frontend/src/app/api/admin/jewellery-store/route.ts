import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS jewellery_product (
        id SERIAL PRIMARY KEY, sku TEXT UNIQUE,
        name TEXT NOT NULL, category TEXT DEFAULT 'rings',
        material TEXT DEFAULT 'gold', gemstone TEXT,
        karat TEXT, weight_g NUMERIC(8,3),
        price NUMERIC(10,2) NOT NULL, cost NUMERIC(10,2),
        stock INT DEFAULT 1, images TEXT[],
        description TEXT, status TEXT DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS jewellery_order (
        id SERIAL PRIMARY KEY, order_number TEXT,
        customer_name TEXT, customer_email TEXT, customer_phone TEXT,
        product_id INT REFERENCES jewellery_product(id),
        product_name TEXT, quantity INT DEFAULT 1,
        unit_price NUMERIC(10,2), total NUMERIC(10,2),
        custom_engraving TEXT, ring_size TEXT,
        payment_method TEXT, status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } finally { client.release(); }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ products: [], orders: [] });
  await ensureTables();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const [products, orders] = await Promise.all([
      client.query('SELECT * FROM jewellery_product ORDER BY created_at DESC LIMIT 200'),
      client.query('SELECT * FROM jewellery_order ORDER BY created_at DESC LIMIT 100'),
    ]);
    return Response.json({ products: products.rows, orders: orders.rows });
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  await ensureTables();
  const body = await req.json() as Record<string, unknown>;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const sku = `JW-${Date.now().toString(36).toUpperCase()}`;
    const r = await client.query(
      'INSERT INTO jewellery_product (sku, name, category, material, price, stock) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [sku, body.name ?? '', body.category ?? 'rings', body.material ?? 'gold', body.price ?? 0, body.stock ?? 1]
    );
    return Response.json(r.rows[0]);
  } finally { client.release(); }
}
