import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const [queue, kpis] = await Promise.all([
    query<{
      id: string; class_name: string; display_name: string; position: number;
      joined_at: string; notify_method: string;
    }>(
      `SELECT w.id, cs.class_name, s.display_name, w.position, w.joined_at, w.notify_method
       FROM waitlist_entry w
       JOIN class_session cs ON cs.id = w.class_session_id
       JOIN student s ON s.id = w.student_id
       WHERE w.status = 'waiting'
       ORDER BY cs.session_date, cs.start_time, w.position`,
    ),
    query<{ waiting: string; promoted_today: string; expired_today: string }>(
      `SELECT COUNT(*) FILTER (WHERE status = 'waiting') AS waiting,
              COUNT(*) FILTER (WHERE status = 'promoted' AND resolved_at::date = CURRENT_DATE) AS promoted_today,
              COUNT(*) FILTER (WHERE status = 'expired' AND resolved_at::date = CURRENT_DATE) AS expired_today
       FROM waitlist_entry`,
    ),
  ]);

  const k = kpis.rows[0];
  return Response.json({
    kpis: {
      onWaitlist: Number(k?.waiting ?? 0),
      promotedToday: Number(k?.promoted_today ?? 0),
      expiredToday: Number(k?.expired_today ?? 0),
    },
    queue: queue.rows.map(q => ({
      id: q.id, class: q.class_name, student: q.display_name, position: `#${q.position}`,
      joined: q.joined_at, method: q.notify_method,
    })),
  });
}
