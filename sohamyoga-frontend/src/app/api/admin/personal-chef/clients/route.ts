import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const service_type = searchParams.get('service_type') || '';
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        SELECT * FROM chef_client
        WHERE ($1='' OR service_type=$1)
        ORDER BY last_name, first_name
      `, [service_type]);
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
        INSERT INTO chef_client (first_name, last_name, email, phone, address, city, province, dietary_restrictions, food_allergies, food_preferences, cuisine_preferences, household_size, service_type, frequency, budget_per_session, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *
      `, [
        body.first_name, body.last_name, body.email, body.phone || null,
        body.address || null, body.city || 'Calgary', body.province || 'AB',
        body.dietary_restrictions || [], body.food_allergies || [],
        body.food_preferences || [], body.cuisine_preferences || [],
        body.household_size || 2, body.service_type || 'meal_prep',
        body.frequency || 'weekly', body.budget_per_session || null,
        body.notes || null,
      ]);
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}
