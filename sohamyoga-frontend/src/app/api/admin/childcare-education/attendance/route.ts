import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
  const room = searchParams.get('room');
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const conds = [`c.status = 'enrolled'`];
      const vals: unknown[] = [date];
      let i = 2;
      if (room) { conds.push(`c.room_name = $${i++}`); vals.push(room); }
      const { rows } = await client.query(
        `SELECT c.id AS child_id, c.name, c.room_name, c.age_group, c.allergies, c.authorized_pickups,
           c.parent1_name, c.parent1_phone,
           a.id AS attendance_id, a.sign_in_time, a.sign_out_time, a.signed_in_by, a.signed_out_by, a.present, a.absent_reason
         FROM cc_child c
         LEFT JOIN cc_attendance a ON a.child_id = c.id AND a.date = $1
         WHERE ${conds.join(' AND ')} ORDER BY c.room_name, c.name`,
        vals
      );
      return Response.json(rows);
    } finally { client.release(); }
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
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO cc_attendance (child_id, date, sign_in_time, present, notes)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING RETURNING *`,
        [body.child_id, body.date || new Date().toISOString().split('T')[0], body.sign_in_time, body.present ?? true, body.notes]
      );
      return Response.json(rows[0] ?? { message: 'Already recorded' }, { status: 201 });
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
