import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public — real replacement for the hardcoded CLASS_DATA array that used to
// back /booking. spotsLeft is computed live from real bookings, never a
// static number that drifts from reality.
export async function GET(_req: NextRequest) {
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const rows = await query<{
    id: string; class_name: string; teacher_name: string; session_date: string; start_time: string;
    duration_minutes: number; level: string | null; style: string | null; price: string; capacity: number; booked: string;
  }>(
    `SELECT cs.id, cs.class_name, cs.teacher_name, cs.session_date, cs.start_time, cs.duration_minutes,
            cs.level, cs.style, cs.price, cs.capacity,
            (SELECT count(*) FROM booking b WHERE b.class_session_id = cs.id AND b.status IN ('pending','confirmed','checked_in'))::text AS booked
     FROM class_session cs
     WHERE cs.status = 'scheduled' AND (cs.session_date > CURRENT_DATE OR (cs.session_date = CURRENT_DATE AND cs.start_time > CURRENT_TIME))
     ORDER BY cs.session_date, cs.start_time`,
  );

  const classes = rows.rows.map(r => ({
    id: r.id, title: r.class_name, teacher: r.teacher_name,
    dateTime: `${new Date(r.session_date).toISOString().slice(0, 10)}T${r.start_time}`, duration: r.duration_minutes,
    level: r.level, style: r.style, price: Number(r.price),
    totalSpots: r.capacity, spotsLeft: Math.max(0, r.capacity - Number(r.booked)),
  }));

  return Response.json({ classes });
}
