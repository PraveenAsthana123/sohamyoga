import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const days = Number(req.nextUrl.searchParams.get('days')) || 7;
  const rows = await query<{
    id: string; session_date: string; start_time: string; class_name: string; teacher_name: string;
    capacity: number; booked: string;
  }>(
    `SELECT cs.id, cs.session_date, cs.start_time, cs.class_name, cs.teacher_name, cs.capacity,
            COUNT(b.id) FILTER (WHERE b.status IN ('confirmed','checked_in','pending')) AS booked
     FROM class_session cs
     LEFT JOIN booking b ON b.class_session_id = cs.id
     WHERE cs.session_date BETWEEN CURRENT_DATE AND CURRENT_DATE + ($1 || ' days')::interval
       AND cs.status = 'scheduled'
     GROUP BY cs.id ORDER BY cs.session_date, cs.start_time`,
    [days],
  );

  return Response.json({
    sessions: rows.rows.map(s => {
      const booked = Number(s.booked);
      const available = Math.max(0, s.capacity - booked);
      const statusLabel = available === 0 ? 'Full' : available <= 2 ? 'Almost Full' : 'Available';
      return {
        id: s.id, date: s.session_date, time: s.start_time.slice(0, 5), class: s.class_name,
        teacher: s.teacher_name, booked, available, statusLabel,
      };
    }),
  });
}
