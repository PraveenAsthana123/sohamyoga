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
    const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const location_id = searchParams.get('location_id');
    const status = searchParams.get('status');
    const pool = getPool();
    const db = await pool.connect();
    try {
      const conditions: string[] = ['r.reservation_date = $1'];
      const values: unknown[] = [date];
      if (location_id) { values.push(location_id); conditions.push(`r.location_id = $${values.length}`); }
      if (status) { values.push(status); conditions.push(`r.status = $${values.length}`); }
      const { rows } = await db.query(
        `SELECT r.*, l.name AS location_name FROM rh_reservation r LEFT JOIN rh_location l ON l.id = r.location_id WHERE ${conditions.join(' AND ')} ORDER BY r.reservation_time`,
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
        `INSERT INTO rh_reservation (location_id,guest_name,phone,email,party_size,reservation_date,reservation_time,duration_minutes,table_number,section,status,special_requests,occasion,source)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
        [body.location_id,body.guest_name,body.phone,body.email,body.party_size,body.reservation_date,body.reservation_time,body.duration_minutes||90,body.table_number,body.section,body.status||'confirmed',body.special_requests,body.occasion,body.source||'phone']
      );
      return Response.json(rows[0], { status: 201 });
    } finally { db.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
