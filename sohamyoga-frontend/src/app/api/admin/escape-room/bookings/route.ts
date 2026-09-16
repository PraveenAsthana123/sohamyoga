import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') ?? '';
  const room_id = searchParams.get('room_id') ?? '';
  const status = searchParams.get('status') ?? '';

  const pool = getPool();
  const client = await pool.connect();
  try {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (date) { conditions.push(`b.booking_date=$${values.length+1}`); values.push(date); }
    if (room_id) { conditions.push(`b.room_id=$${values.length+1}`); values.push(room_id); }
    if (status) { conditions.push(`b.status=$${values.length+1}`); values.push(status); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const r = await client.query(
      `SELECT b.*,r.room_name,r.theme,r.difficulty
       FROM er_booking b LEFT JOIN er_room r ON r.id=b.room_id
       ${where} ORDER BY b.booking_date DESC,b.start_time`,
      values
    );
    return Response.json({ bookings: r.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    // Check for overlapping bookings in same room
    const overlap = await client.query(
      `SELECT id FROM er_booking
       WHERE room_id=$1 AND booking_date=$2 AND status NOT IN ('cancelled','no_show')
         AND (start_time, start_time + (SELECT duration_minutes FROM er_room WHERE id=$1) * INTERVAL '1 minute')
             OVERLAPS ($3::time, $3::time + $4 * INTERVAL '1 minute')`,
      [body.room_id, body.booking_date, body.start_time, body.duration_override || 60]
    );
    if (overlap.rows.length) {
      return Response.json({ error: 'Room is already booked at this time' }, { status: 409 });
    }

    const r = await client.query(
      `INSERT INTO er_booking (room_id,customer_name,customer_email,customer_phone,booking_date,start_time,player_count,total_amount,deposit_paid,balance_due,promo_code,discount_pct,group_type,notes)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [body.room_id,body.customer_name,body.customer_email,body.customer_phone,
       body.booking_date,body.start_time,body.player_count,body.total_amount,
       body.deposit_paid||0,body.balance_due||body.total_amount,
       body.promo_code||null,body.discount_pct||0,body.group_type||null,body.notes||null]
    );
    return Response.json({ booking: r.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
