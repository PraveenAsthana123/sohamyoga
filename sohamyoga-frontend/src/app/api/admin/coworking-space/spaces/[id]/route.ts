import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(`SELECT * FROM cw_space WHERE id = $1`, [params.id]);
    if (!result.rows.length) return Response.json({ error: 'Space not found' }, { status: 404 });
    const bookings = await client.query(
      `SELECT b.*, m.first_name, m.last_name FROM cw_booking b
       LEFT JOIN cw_member m ON b.member_id = m.id
       WHERE b.space_id = $1 AND b.booking_date >= CURRENT_DATE
       ORDER BY b.booking_date, b.start_time`,
      [params.id]
    );
    return Response.json({ space: result.rows[0], upcoming_bookings: bookings.rows });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const allowed = ['space_name','space_type','capacity','floor','amenities','hourly_rate','daily_rate','monthly_rate','is_available'];
  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  for (const key of allowed) {
    if (key in body) { updates.push(`${key} = $${idx++}`); values.push(body[key]); }
  }
  if (!updates.length) return Response.json({ error: 'No valid fields' }, { status: 400 });
  values.push(params.id);
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE cw_space SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!result.rows.length) return Response.json({ error: 'Space not found' }, { status: 404 });
    return Response.json({ space: result.rows[0] });
  } finally {
    client.release();
  }
}
