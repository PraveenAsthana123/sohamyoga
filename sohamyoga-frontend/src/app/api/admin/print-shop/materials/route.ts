import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(req.url);
    const low_stock = searchParams.get('low_stock') === 'true';
    const category = searchParams.get('category');
    let q = `SELECT *, (stock_quantity <= reorder_point) AS is_low_stock FROM ps_material WHERE 1=1`;
    const vals: string[] = [];
    let idx = 1;
    if (low_stock) { q += ` AND stock_quantity <= reorder_point`; }
    if (category) { q += ` AND category = $${idx++}`; vals.push(category); }
    q += ` ORDER BY is_low_stock DESC, name`;
    const { rows } = await client.query(q, vals);
    return NextResponse.json(rows);
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { rows } = await client.query(`
      INSERT INTO ps_material (name, category, stock_quantity, unit, reorder_point, cost_per_unit, supplier, sku)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [body.name, body.category ?? null, body.stock_quantity ?? 0, body.unit ?? 'sheets', body.reorder_point ?? 100, body.cost_per_unit ?? null, body.supplier ?? null, body.sku ?? null]);
    return NextResponse.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}
