import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const low_stock = searchParams.get('low_stock') === 'true';
  const expiring = searchParams.get('expiring') === 'true';

  const pool = getPool();
  const client = await pool.connect();
  try {
    const conditions: string[] = [];
    if (low_stock) conditions.push('quantity_on_hand <= reorder_point');
    if (expiring) conditions.push(`expiry_date IS NOT NULL AND expiry_date <= (CURRENT_DATE + INTERVAL '30 days')`);

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT *,
        CASE WHEN expiry_date IS NOT NULL THEN (expiry_date - CURRENT_DATE) ELSE NULL END as days_until_expiry,
        CASE WHEN quantity_on_hand <= reorder_point THEN true ELSE false END as is_low_stock
       FROM ts_supply ${where}
       ORDER BY category, name`
    );
    return NextResponse.json({ supplies: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const body = await req.json();
  const {
    name, category, brand, quantity_on_hand, unit = 'unit', reorder_point = 10,
    cost_per_unit, supplier, is_sterile_single_use = false, expiry_date,
  } = body;

  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO ts_supply (name, category, brand, quantity_on_hand, unit, reorder_point,
        cost_per_unit, supplier, is_sterile_single_use, expiry_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [name, category, brand, quantity_on_hand, unit, reorder_point,
        cost_per_unit, supplier, is_sterile_single_use, expiry_date]
    );
    return NextResponse.json({ supply: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
