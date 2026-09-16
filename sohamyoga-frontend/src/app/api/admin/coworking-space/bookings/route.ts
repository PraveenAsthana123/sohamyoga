import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureSchema() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS cw_booking (
        id SERIAL PRIMARY KEY, member_id INTEGER REFERENCES cw_member(id),
        space_id INTEGER REFERENCES cw_space(id),
        booking_date DATE NOT NULL, start_time TIME NOT NULL, end_time TIME NOT NULL,
        status TEXT DEFAULT 'confirmed' CHECK (status IN ('pending','confirmed','checked_in','completed','cancelled','no_show')),
        attendees INTEGER DEFAULT 1, purpose TEXT, amount_charged DECIMAL(10,2),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSchema();
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const space_id = searchParams.get('space_id');
  const member_id = searchParams.get('member_id');
  const status = searchParams.get('status');
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (date) { conditions.push(`b.booking_date = $${idx++}`); values.push(date); }
  if (space_id) { conditions.push(`b.space_id = $${idx++}`); values.push(space_id); }
  if (member_id) { conditions.push(`b.member_id = $${idx++}`); values.push(member_id); }
  if (status) { conditions.push(`b.status = $${idx++}`); values.push(status); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT b.*, m.first_name, m.last_name, m.email, s.space_name, s.space_type
       FROM cw_booking b
       LEFT JOIN cw_member m ON b.member_id = m.id
       LEFT JOIN cw_space s ON b.space_id = s.id
       ${where} ORDER BY b.booking_date DESC, b.start_time DESC LIMIT 200`,
      values
    );
    return Response.json({ bookings: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSchema();
  const body = await req.json();
  const { member_id, space_id, booking_date, start_time, end_time, attendees = 1, purpose, amount_charged } = body;
  if (!space_id || !booking_date || !start_time || !end_time) {
    return Response.json({ error: 'space_id, booking_date, start_time, end_time required' }, { status: 400 });
  }
  const pool = getPool();
  const client = await pool.connect();
  try {
    // Conflict check: no overlapping bookings for same space+date+time
    const conflict = await client.query(
      `SELECT id FROM cw_booking
       WHERE space_id = $1 AND booking_date = $2
         AND status NOT IN ('cancelled','no_show')
         AND start_time < $4::time AND end_time > $3::time`,
      [space_id, booking_date, start_time, end_time]
    );
    if (conflict.rows.length > 0) {
      return Response.json({ error: 'Space is already booked for this time slot', conflict: true }, { status: 409 });
    }
    const result = await client.query(
      `INSERT INTO cw_booking (member_id, space_id, booking_date, start_time, end_time, attendees, purpose, amount_charged)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [member_id, space_id, booking_date, start_time, end_time, attendees, purpose, amount_charged]
    );
    return Response.json({ booking: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
