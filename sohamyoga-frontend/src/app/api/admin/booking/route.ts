export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const limit = Math.min(Number(searchParams.get('limit') ?? 100), 500);

  const client = await pool.connect();
  try {
    const whereParts: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (status) { whereParts.push(`b.status = $${idx++}`); params.push(status); }

    const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const bookings = await client.query(`
      SELECT b.id, b.status, b.channel, b.booked_at, b.checked_in_at, b.cancelled_at,
        s.display_name as student_name, s.email as student_email,
        cs.starts_at, cs.ends_at, cs.location_name,
        cs.capacity, cs.enrolled_count
      FROM booking b
      LEFT JOIN student s ON s.id = b.student_id
      LEFT JOIN class_session cs ON cs.id = b.class_session_id
      ${where}
      ORDER BY b.booked_at DESC
      LIMIT $${idx}
    `, [...params, limit]);

    const summary = await client.query(`
      SELECT status, COUNT(*) as count
      FROM booking GROUP BY status
    `);

    const todayCount = await client.query(`
      SELECT COUNT(*) as count FROM booking
      WHERE booked_at >= DATE_TRUNC('day', NOW())
    `);

    const summaryMap = summary.rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = Number(r.count);
      return acc;
    }, {});

    return NextResponse.json({
      bookings: bookings.rows,
      summary: {
        ...summaryMap,
        total: bookings.rows.length,
        today: Number(todayCount.rows[0]?.count ?? 0),
      },
    });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const body = await req.json() as { id: string; status: string };
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const client = await pool.connect();
  try {
    const extra = body.status === 'cancelled'
      ? `, cancelled_at = NOW()`
      : body.status === 'checked_in'
        ? `, checked_in_at = NOW()`
        : '';

    const res = await client.query(
      `UPDATE booking SET status = $1${extra} WHERE id = $2 RETURNING *`,
      [body.status, body.id]
    );
    if (!res.rowCount) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json({ booking: res.rows[0] });
  } finally {
    client.release();
  }
}
