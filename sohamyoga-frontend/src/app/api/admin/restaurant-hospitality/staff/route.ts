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
    const role = searchParams.get('role');
    const pool = getPool();
    const db = await pool.connect();
    try {
      const conditions: string[] = [];
      const values: unknown[] = [];
      if (location_id) { values.push(location_id); conditions.push(`s.location_id = $${values.length}`); }
      if (role) { values.push(role); conditions.push(`s.role = $${values.length}`); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await db.query(
        `SELECT s.*, l.name AS location_name FROM rh_staff s LEFT JOIN rh_location l ON l.id = s.location_id ${where} ORDER BY l.name, s.role, s.name`,
        values
      );
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
    const pool = getPool();
    const db = await pool.connect();
    try {
      const { rows } = await db.query(
        `INSERT INTO rh_staff (location_id,name,role,employment_type,hourly_rate,sin_last4,status,start_date,food_safe_expiry,serving_it_right_expiry,notes)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [body.location_id,body.name,body.role,body.employment_type||'part_time',body.hourly_rate||null,body.sin_last4,body.status||'active',body.start_date||null,body.food_safe_expiry||null,body.serving_it_right_expiry||null,body.notes]
      );
      return Response.json(rows[0], { status: 201 });
    } finally { db.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
