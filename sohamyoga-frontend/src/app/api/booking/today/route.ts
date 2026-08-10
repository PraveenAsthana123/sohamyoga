import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const rows = await query<{
    id: string; start_time: string; class_name: string; display_name: string; status: string; channel: string;
  }>(
    `SELECT b.id, cs.start_time, cs.class_name, s.display_name, b.status, b.channel
     FROM booking b
     JOIN class_session cs ON cs.id = b.class_session_id
     JOIN student s ON s.id = b.student_id
     WHERE cs.session_date = CURRENT_DATE
     ORDER BY cs.start_time, s.display_name`,
  );

  return Response.json({
    date: new Date().toISOString().slice(0, 10),
    bookings: rows.rows.map(r => ({
      id: r.id, time: r.start_time.slice(0, 5), class: r.class_name, student: r.display_name,
      status: r.status, method: r.channel,
    })),
  });
}
