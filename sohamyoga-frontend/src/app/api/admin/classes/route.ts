export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const client = await pool.connect();
  try {
    const [sessions, bookingStats, waitlist] = await Promise.all([
      client.query(`
        SELECT cs.id, cs.class_name, cs.teacher_name, cs.session_date,
          cs.start_time, cs.duration_minutes, cs.location, cs.capacity,
          cs.status, cs.level, cs.style, cs.price,
          COUNT(DISTINCT b.id) FILTER (WHERE b.status NOT IN ('cancelled')) as enrolled_count,
          COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'cancelled') as cancelled_count,
          COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'checked_in') as checked_in_count
        FROM class_session cs
        LEFT JOIN booking b ON b.class_session_id = cs.id
        GROUP BY cs.id
        ORDER BY cs.session_date DESC, cs.start_time DESC
        LIMIT 100
      `).catch(() => ({ rows: [] })),

      client.query(`
        SELECT 
          COUNT(*) as total_bookings,
          COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
          COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
          COUNT(*) FILTER (WHERE status = 'checked_in') as checked_in,
          COUNT(*) FILTER (WHERE booked_at >= DATE_TRUNC('week', NOW())) as this_week
        FROM booking
      `).catch(() => ({ rows: [{}] })),

      client.query(`
        SELECT we.id, we.student_id, s.display_name as student_name,
          cs.class_name, cs.session_date, we.created_at
        FROM waitlist_entry we
        LEFT JOIN student s ON s.id = we.student_id
        LEFT JOIN class_session cs ON cs.id = we.class_session_id
        ORDER BY we.created_at DESC
        LIMIT 50
      `).catch(() => ({ rows: [] })),
    ]);

    const bs = bookingStats.rows[0] ?? {};
    const upcomingSessions = (sessions.rows as Array<{ session_date: string; status: string }>)
      .filter(s => s.session_date >= new Date().toISOString().split('T')[0] && s.status === 'scheduled');

    const summary = {
      totalSessions: sessions.rows.length,
      upcomingSessions: upcomingSessions.length,
      totalBookings: Number(bs.total_bookings ?? 0),
      confirmedBookings: Number(bs.confirmed ?? 0),
      cancelledBookings: Number(bs.cancelled ?? 0),
      checkedIn: Number(bs.checked_in ?? 0),
      bookingsThisWeek: Number(bs.this_week ?? 0),
      waitlisted: waitlist.rows.length,
    };

    return NextResponse.json({
      sessions: sessions.rows,
      waitlist: waitlist.rows,
      summary,
    });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const body = await req.json() as { id: string; status: string };
  if (!body.id || !body.status) return NextResponse.json({ error: 'id and status required' }, { status: 400 });

  const allowed = ['scheduled', 'completed', 'cancelled'];
  if (!allowed.includes(body.status)) {
    return NextResponse.json({ error: `status must be one of ${allowed.join(', ')}` }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const res = await client.query(
      `UPDATE class_session SET status = $1 WHERE id = $2 RETURNING *`,
      [body.status, body.id]
    );
    if (!res.rowCount) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json({ session: res.rows[0] });
  } finally {
    client.release();
  }
}
