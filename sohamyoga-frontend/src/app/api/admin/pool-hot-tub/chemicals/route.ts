import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS pool_chemicals (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'sanitizer',
      unit TEXT DEFAULT 'kg',
      quantity_on_hand NUMERIC(10,2) DEFAULT 0,
      reorder_threshold NUMERIC(10,2) DEFAULT 5,
      cost_per_unit NUMERIC(8,2) DEFAULT 0,
      supplier TEXT,
      health_canada_reg TEXT,
      notes TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

export async function GET(req: NextRequest): Promise<Response> {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const low_stock = searchParams.get('low_stock');
  const category = searchParams.get('category');

  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureTables(client);
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (low_stock === 'true') { conditions.push(`quantity_on_hand <= reorder_threshold`); }
    if (category) { conditions.push(`category = $${idx++}`); params.push(category); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await client.query(
      `SELECT *, quantity_on_hand <= reorder_threshold AS is_low_stock FROM pool_chemicals ${where} ORDER BY name`,
      params
    );
    return Response.json({ chemicals: rows.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureTables(client);
    const { name, category, unit, quantity_on_hand, reorder_threshold, cost_per_unit, supplier, health_canada_reg, notes } = body;
    if (!name) return Response.json({ error: 'name required' }, { status: 400 });
    const row = await client.query(
      `INSERT INTO pool_chemicals (name, category, unit, quantity_on_hand, reorder_threshold, cost_per_unit, supplier, health_canada_reg, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [name, category || 'sanitizer', unit || 'kg', quantity_on_hand || 0, reorder_threshold || 5, cost_per_unit || 0, supplier, health_canada_reg, notes]
    );
    return Response.json({ chemical: row.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
