import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const location_id = searchParams.get('location_id');
    const category = searchParams.get('category');
    const pool = getPool();
    const db = await pool.connect();
    try {
      const conditions: string[] = [];
      const values: unknown[] = [];
      if (location_id) { values.push(location_id); conditions.push(`location_id = $${values.length}`); }
      if (category && category !== 'all') { values.push(category); conditions.push(`category = $${values.length}`); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await db.query(`SELECT * FROM rh_menu_item ${where} ORDER BY category, name`, values);
      return Response.json(rows);
    } finally { db.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    // Auto-calculate food cost pct if both provided
    const food_cost_pct = body.price && body.food_cost ? Math.round((body.food_cost / body.price) * 100 * 10) / 10 : body.food_cost_pct || null;
    const pool = getPool();
    const db = await pool.connect();
    try {
      const { rows } = await db.query(
        `INSERT INTO rh_menu_item (location_id,name,category,description,price,food_cost,food_cost_pct,allergens,dietary,is_available,is_featured,calories,prep_time_minutes)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [body.location_id,body.name,body.category,body.description,body.price||null,body.food_cost||null,food_cost_pct,body.allergens||[],body.dietary||[],body.is_available??true,body.is_featured??false,body.calories||null,body.prep_time_minutes||null]
      );
      return Response.json(rows[0], { status: 201 });
    } finally { db.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
