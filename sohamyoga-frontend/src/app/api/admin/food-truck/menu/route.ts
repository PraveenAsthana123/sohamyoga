import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const truck_id = searchParams.get('truck_id');
  const category = searchParams.get('category');

  const pool = getPool();
  const client = await pool.connect();
  try {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (truck_id) { conditions.push(`m.truck_id = $${idx++}`); values.push(truck_id); }
    if (category) { conditions.push(`m.category = $${idx++}`); values.push(category); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT m.*, t.truck_name FROM ft_menu_item m
       LEFT JOIN ft_truck t ON t.id = m.truck_id
       ${where}
       ORDER BY m.category, m.name`,
      values
    );
    return NextResponse.json({ items: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const body = await req.json();
  const {
    truck_id, name, description, category, price, food_cost,
    is_seasonal = false, dietary_tags, allergens, avg_servings_per_event = 30,
  } = body;

  if (!truck_id || !name || !price) {
    return NextResponse.json({ error: 'truck_id, name, price required' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO ft_menu_item (truck_id, name, description, category, price, food_cost,
        is_seasonal, dietary_tags, allergens, avg_servings_per_event)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [truck_id, name, description, category, price, food_cost,
        is_seasonal, dietary_tags, allergens, avg_servings_per_event]
    );
    return NextResponse.json({ item: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
