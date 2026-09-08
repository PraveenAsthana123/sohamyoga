import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

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

  const tenantId = await getPrimaryTenantId();

  const [monthRate, today, streaks, perStudent, policy, lateArrivals] = await Promise.all([
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
    query<{ late_threshold_minutes: number }>(
      `SELECT late_threshold_minutes FROM attendance_policy WHERE tenant_id = $1`,
      [tenantId],
    ),
    // Real lateness computation -- attended_at and session_date/start_time
    // were both already real columns; only the arithmetic and a
    // configurable threshold were missing. minutes_late clamps at 0 (an
    // early/on-time check-in is never "negative late").
    query<{ display_name: string; class_name: string; session_date: string; minutes_late: number }>(
      `SELECT s.display_name, cs.class_name, cs.session_date::text,
              GREATEST(0, ROUND(EXTRACT(EPOCH FROM (ar.attended_at - (cs.session_date + cs.start_time)))/60))::int AS minutes_late
       FROM attendance_record ar
       JOIN class_session cs ON cs.id = ar.class_session_id
       JOIN student s ON s.id = ar.student_id
       WHERE ar.tenant_id = $1 AND ar.status = 'attended' AND ar.attended_at IS NOT NULL
         AND ar.attended_at > (cs.session_date + cs.start_time)::timestamptz
             + (COALESCE((SELECT late_threshold_minutes FROM attendance_policy WHERE tenant_id = $1), 10) || ' minutes')::interval
       ORDER BY ar.attended_at DESC LIMIT 50`,
      [tenantId],
    ),
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
    latePolicy: { thresholdMinutes: policy.rows[0]?.late_threshold_minutes ?? 10 },
    lateArrivals: lateArrivals.rows.map(r => ({
      studentName: r.display_name, className: r.class_name, sessionDate: r.session_date, minutesLate: r.minutes_late,
    })),
  });
}

export async function PUT(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { thresholdMinutes?: number } | null;
  const threshold = Number(body?.thresholdMinutes);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 120) {
    return Response.json({ error: 'thresholdMinutes must be a number between 0 and 120.' }, { status: 400 });
  }

  const tenantId = await getPrimaryTenantId();
  await query(
    `INSERT INTO attendance_policy (tenant_id, late_threshold_minutes, updated_by)
     VALUES ($1,$2,$3)
     ON CONFLICT (tenant_id) DO UPDATE SET late_threshold_minutes = $2, updated_by = $3, updated_at = now()`,
    [tenantId, Math.round(threshold), principal?.email ?? principal?.id ?? 'admin'],
  );
  return Response.json({ ok: true, thresholdMinutes: Math.round(threshold) });
}
