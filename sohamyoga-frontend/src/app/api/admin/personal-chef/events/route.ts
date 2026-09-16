import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || '';
  const date = searchParams.get('date') || '';
  const event_type = searchParams.get('event_type') || '';
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        SELECT e.*, c.first_name, c.last_name, c.email, c.phone,
               c.dietary_restrictions, c.food_allergies
        FROM chef_event e
        LEFT JOIN chef_client c ON c.id=e.client_id
        WHERE ($1='' OR e.status=$1)
          AND ($2='' OR e.event_date=$2::date)
          AND ($3='' OR e.event_type=$3)
        ORDER BY e.event_date, e.start_time
      `, [status, date, event_type]);
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
        INSERT INTO chef_event (client_id, event_type, event_date, start_time, end_time, guest_count, location, menu_theme, courses, dietary_accommodations, special_requests, chef_fee, grocery_estimate, deposit_paid)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *
      `, [
        body.client_id, body.event_type, body.event_date,
        body.start_time || null, body.end_time || null,
        body.guest_count || 1, body.location || null,
        body.menu_theme || null, body.courses || 3,
        body.dietary_accommodations || [], body.special_requests || null,
        body.chef_fee || null, body.grocery_estimate || null,
        body.deposit_paid || 0,
      ]);
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}
