import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        SELECT gc.*, COUNT(gb.id) FILTER (WHERE gb.booking_date = CURRENT_DATE AND gb.status != 'cancelled') AS booking_count_today
        FROM gym_class gc
        LEFT JOIN gym_booking gb ON gb.class_id = gc.id
        WHERE gc.is_active = true
        GROUP BY gc.id
        ORDER BY gc.schedule_time NULLS LAST, gc.name
      `);
      return Response.json({ classes: rows });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { name, description, instructor, class_type = 'group', capacity = 20, duration_minutes = 60, schedule_days, schedule_time, location = 'Studio A', price_drop_in } = body;
    if (!name || !instructor) return Response.json({ error: 'name and instructor required' }, { status: 400 });
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO gym_class (name,description,instructor,class_type,capacity,duration_minutes,schedule_days,schedule_time,location,price_drop_in)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [name, description ?? null, instructor, class_type, capacity, duration_minutes, schedule_days ?? null, schedule_time ?? null, location, price_drop_in ?? null]
      );
      return Response.json({ class: rows[0] }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
