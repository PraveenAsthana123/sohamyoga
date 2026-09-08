import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const rows = await query<{
    id: string; class_name: string; teacher_name: string; session_date: string; start_time: string;
    duration_minutes: number; location: string | null; level: string | null; style: string | null; price: string; capacity: number; booked: string; status: string;
  }>(
    `SELECT cs.id, cs.class_name, cs.teacher_name, cs.session_date, cs.start_time, cs.duration_minutes, cs.location,
            cs.level, cs.style, cs.price, cs.capacity, cs.status,
            (SELECT count(*) FROM booking b WHERE b.class_session_id = cs.id AND b.status IN ('pending','confirmed','checked_in'))::text AS booked
     FROM class_session cs WHERE cs.id = $1`,
    [params.id],
  );
  if (!rows.rowCount) return Response.json({ error: 'Class not found.' }, { status: 404 });
  const r = rows.rows[0];
  return Response.json({
    id: r.id, title: r.class_name, teacher: r.teacher_name,
    dateTime: `${new Date(r.session_date).toISOString().slice(0, 10)}T${r.start_time}`, duration: r.duration_minutes, location: r.location,
    level: r.level, style: r.style, price: Number(r.price),
    totalSpots: r.capacity, spotsLeft: Math.max(0, r.capacity - Number(r.booked)),
    status: r.status,
  });
}
