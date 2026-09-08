import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real attendance overview -- previously /admin/attendance was 100%
// hardcoded mock data across all 7 tabs (found live during a 2026-09-01
// end-to-end demo walkthrough, which also found the deeper root cause:
// attendance_record was structurally unreachable until that same session
// fixed enrollment_id's NOT NULL constraint and the real check-in route).
// This is the first real query this page has ever had.
export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const [monthRate, today, streaks, perStudent] = await Promise.all([
    query<{ attended: string; total: string }>(`
      SELECT count(*) FILTER (WHERE b.status = 'checked_in')::text AS attended, count(*)::text AS total
      FROM booking b JOIN class_session cs ON cs.id = b.class_session_id
      WHERE cs.session_date >= date_trunc('month', CURRENT_DATE) AND b.status <> 'cancelled'
    `),
    query<{ present: string; no_show: string; total: string }>(`
      SELECT count(*) FILTER (WHERE b.status = 'checked_in')::text AS present,
             count(*) FILTER (WHERE b.status IN ('confirmed','pending') AND cs.session_date < CURRENT_DATE)::text AS no_show,
             count(*)::text AS total
      FROM booking b JOIN class_session cs ON cs.id = b.class_session_id
      WHERE cs.session_date = CURRENT_DATE AND b.status <> 'cancelled'
    `),
    query<{ count: string }>(`SELECT count(*)::text FROM streak WHERE current_streak >= 7`),
    query(`
      SELECT s.display_name, count(ar.id)::int AS classes_attended,
             count(b.id)::int AS classes_booked,
             max(ar.attended_at)::text AS last_seen,
             COALESCE(st.current_streak, 0) AS current_streak
      FROM student s
      LEFT JOIN attendance_record ar ON ar.student_id = s.id AND ar.status = 'attended'
      LEFT JOIN booking b ON b.student_id = s.id AND b.status <> 'cancelled'
      LEFT JOIN streak st ON st.user_id = s.user_id
      WHERE s.status = 'active'
      GROUP BY s.id, s.display_name, st.current_streak
      HAVING count(b.id) > 0
      ORDER BY classes_attended DESC LIMIT 100
    `),
  ]);

  const attended = Number(monthRate.rows[0]?.attended ?? 0);
  const totalMonth = Number(monthRate.rows[0]?.total ?? 0);

  return Response.json({
    kpis: {
      attendanceRateMonth: totalMonth > 0 ? Math.round((attended / totalMonth) * 100) : 0,
      studentsPresentToday: Number(today.rows[0]?.present ?? 0),
      noShowsToday: Number(today.rows[0]?.no_show ?? 0),
      totalBookedToday: Number(today.rows[0]?.total ?? 0),
      streakHolders7Plus: Number(streaks.rows[0]?.count ?? 0),
    },
    students: perStudent.rows,
  });
}
