import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const db = await pool.connect();
    try {
      const { rows } = await db.query(`SELECT * FROM rh_menu_item WHERE id = $1`, [params.id]);
      if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json(rows[0]);
    } finally { db.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const food_cost_pct = body.price && body.food_cost ? Math.round((body.food_cost / body.price) * 100 * 10) / 10 : body.food_cost_pct || null;
    const pool = getPool();
    const db = await pool.connect();
    try {
      const { rows } = await db.query(
        `UPDATE rh_menu_item SET name=$1,category=$2,description=$3,price=$4,food_cost=$5,food_cost_pct=$6,allergens=$7,dietary=$8,is_available=$9,is_featured=$10,calories=$11,prep_time_minutes=$12 WHERE id=$13 RETURNING *`,
        [body.name,body.category,body.description,body.price||null,body.food_cost||null,food_cost_pct,body.allergens||[],body.dietary||[],body.is_available??true,body.is_featured??false,body.calories||null,body.prep_time_minutes||null,params.id]
      );
      return Response.json(rows[0]);
    } finally { db.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
