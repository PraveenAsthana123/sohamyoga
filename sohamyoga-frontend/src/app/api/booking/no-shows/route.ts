// GET /api/booking/no-shows — this month's no-show log with a running strike
// count per student (policy: 3 strikes in a rolling month = suspended, per the
// Rules tab). No separate strikes table — computed live from booking rows.

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
    id: string; display_name: string; class_name: string; checked_in_at: string | null;
    booked_at: string; strikes: string;
  }>(
    `SELECT b.id, s.display_name, cs.class_name, b.booked_at,
            COUNT(*) OVER (PARTITION BY b.student_id) AS strikes
     FROM booking b
     JOIN class_session cs ON cs.id = b.class_session_id
     JOIN student s ON s.id = b.student_id
     WHERE b.status = 'no_show' AND b.booked_at >= date_trunc('month', now())
     ORDER BY b.booked_at DESC`,
  );

  const summary = await query<{ total: string; suspensions: string; warnings: string }>(
    `WITH per_student AS (
       SELECT student_id, COUNT(*) AS strikes FROM booking
       WHERE status = 'no_show' AND booked_at >= date_trunc('month', now())
       GROUP BY student_id
     )
     SELECT (SELECT COUNT(*) FROM booking WHERE status = 'no_show' AND booked_at >= date_trunc('month', now())) AS total,
            (SELECT COUNT(*) FROM per_student WHERE strikes >= 3) AS suspensions,
            (SELECT COUNT(*) FROM per_student WHERE strikes < 3) AS warnings`,
  );

  const s = summary.rows[0];
  return Response.json({
    kpis: {
      noShowsMonth: Number(s?.total ?? 0),
      strikeWarnings: Number(s?.warnings ?? 0),
      suspensions: Number(s?.suspensions ?? 0),
    },
    log: rows.rows.map(r => {
      const strikes = Number(r.strikes);
      return {
        id: r.id, student: r.display_name, class: r.class_name, date: r.booked_at, strikes,
        action: strikes >= 3 ? 'Suspended' : `Warning #${strikes}`,
      };
    }),
  });
}
