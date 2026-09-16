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
    const class_id = searchParams.get('class_id');
    const date = searchParams.get('date');
    const status = searchParams.get('status');
    const pool = getPool();
    const client = await pool.connect();
    try {
      const params: unknown[] = [];
      let where = 'WHERE 1=1';
      if (class_id) { params.push(class_id); where += ` AND gb.class_id=$${params.length}`; }
      if (date) { params.push(date); where += ` AND gb.booking_date=$${params.length}`; }
      if (status) { params.push(status); where += ` AND gb.status=$${params.length}`; }
      const { rows } = await client.query(`
        SELECT gb.*, gm.first_name, gm.last_name, gm.email, gc.name AS class_name, gc.instructor
        FROM gym_booking gb
        LEFT JOIN gym_member gm ON gm.id = gb.member_id
        LEFT JOIN gym_class gc ON gc.id = gb.class_id
        ${where} ORDER BY gb.booking_date DESC, gb.booked_at DESC LIMIT 200
      `, params);
      return Response.json({ bookings: rows });
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
    const { member_id, class_id, booking_date, payment_status = 'included' } = body;
    if (!member_id || !class_id || !booking_date) return Response.json({ error: 'member_id, class_id, booking_date required' }, { status: 400 });
    const pool = getPool();
    const client = await pool.connect();
    try {
      // Capacity check
      const capRes = await client.query(`SELECT capacity FROM gym_class WHERE id=$1`, [class_id]);
      const bookedRes = await client.query(`SELECT COUNT(*) AS cnt FROM gym_booking WHERE class_id=$1 AND booking_date=$2 AND status NOT IN ('cancelled','no_show')`, [class_id, booking_date]);
      const capacity = capRes.rows[0]?.capacity ?? 20;
      const booked = Number(bookedRes.rows[0]?.cnt ?? 0);
      const status = booked >= capacity ? 'waitlist' : 'booked';
      const { rows } = await client.query(
        `INSERT INTO gym_booking (member_id,class_id,booking_date,status,payment_status) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [member_id, class_id, booking_date, status, payment_status]
      );
      return Response.json({ booking: rows[0], waitlisted: status === 'waitlist' }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
