import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category') || '';
  const cuisine = searchParams.get('cuisine') || '';
  const dietary = searchParams.get('dietary') || '';
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        SELECT * FROM chef_recipe
        WHERE ($1='' OR category=$1)
          AND ($2='' OR cuisine ILIKE $2)
          AND ($3='' OR $3 = ANY(dietary_tags))
        ORDER BY is_signature DESC, times_served DESC, name
      `, [category, `%${cuisine}%`, dietary]);
      return Response.json(rows);
    } finally { client.release(); }
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        INSERT INTO chef_recipe (name, category, cuisine, description, servings, prep_time_minutes, cook_time_minutes, difficulty, dietary_tags, allergens, ingredients, instructions, cost_estimate_per_serving, is_signature)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *
      `, [
        body.name, body.category || null, body.cuisine || null,
        body.description || null, body.servings || 4,
        body.prep_time_minutes || null, body.cook_time_minutes || null,
        body.difficulty || 'medium', body.dietary_tags || [], body.allergens || [],
        body.ingredients ? JSON.stringify(body.ingredients) : null,
        body.instructions || null, body.cost_estimate_per_serving || null,
        body.is_signature || false,
      ]);
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}
