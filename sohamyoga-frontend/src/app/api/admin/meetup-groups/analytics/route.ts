import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const [growthRes, topGroupsRes, showRateRes, platformRes, categoryRes] = await Promise.all([
      // Growth by month (last 6 months)
      client.query(`
        WITH months AS (
          SELECT generate_series(
            date_trunc('month', NOW() - INTERVAL '5 months'),
            date_trunc('month', NOW()),
            '1 month'::interval
          ) AS month
        )
        SELECT
          to_char(m.month, 'Mon YYYY') AS month,
          COALESCE(new_m.count, 0) AS new_members,
          COALESCE(ev.count, 0) AS events_held,
          COALESCE(rv.count, 0) AS total_rsvps
        FROM months m
        LEFT JOIN (
          SELECT date_trunc('month', created_at) AS mo, COUNT(*) AS count
          FROM meetup_member GROUP BY mo
        ) new_m ON new_m.mo = m.month
        LEFT JOIN (
          SELECT date_trunc('month', start_time) AS mo, COUNT(*) AS count
          FROM meetup_event WHERE status IN ('published','completed') GROUP BY mo
        ) ev ON ev.mo = m.month
        LEFT JOIN (
          SELECT date_trunc('month', rsvp_at) AS mo, COUNT(*) AS count
          FROM meetup_rsvp GROUP BY mo
        ) rv ON rv.mo = m.month
        ORDER BY m.month
      `),

      // Top groups by attendance
      client.query(`
        SELECT
          g.name AS group_name,
          COUNT(DISTINCT e.id) AS total_events,
          COALESCE(AVG(e.actual_attendees), 0)::NUMERIC(8,1) AS avg_attendance,
          SUM(COALESCE(e.actual_attendees, 0)) AS total_attended
        FROM meetup_group g
        LEFT JOIN meetup_event e ON e.group_id = g.id AND e.status = 'completed'
        WHERE g.status = 'active'
        GROUP BY g.id, g.name
        ORDER BY avg_attendance DESC
        LIMIT 10
      `),

      // RSVP to show rate
      client.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'attended') AS attended,
          COUNT(*) FILTER (WHERE status IN ('going','attended')) AS going
        FROM meetup_rsvp
      `),

      // Platform breakdown
      client.query(`
        SELECT source AS platform, COUNT(*) AS rsvps_from_platform
        FROM meetup_rsvp
        GROUP BY source
        ORDER BY rsvps_from_platform DESC
      `),

      // Category engagement
      client.query(`
        SELECT
          g.category,
          COUNT(DISTINCT g.id) AS groups_count,
          COUNT(DISTINCT m.id) AS members,
          COUNT(DISTINCT e.id) AS events,
          COALESCE(AVG(
            (SELECT COUNT(*) FROM meetup_rsvp r WHERE r.event_id = e.id)
          ), 0)::NUMERIC(8,1) AS avg_rsvps
        FROM meetup_group g
        LEFT JOIN meetup_member m ON m.group_id = g.id AND m.status = 'active'
        LEFT JOIN meetup_event e ON e.group_id = g.id AND e.status IN ('published','completed')
        WHERE g.status = 'active'
        GROUP BY g.category
        ORDER BY members DESC
      `),
    ]);

    const { attended, going } = showRateRes.rows[0] as { attended: string; going: string };
    const rsvp_to_show_rate = Number(going) > 0
      ? Math.round((Number(attended) / Number(going)) * 100)
      : 0;

    return Response.json({
      growth_by_month: growthRes.rows,
      top_groups_by_attendance: topGroupsRes.rows,
      rsvp_to_show_rate,
      platform_breakdown: platformRes.rows,
      category_engagement: categoryRes.rows,
    });
  } finally {
    client.release();
  }
}
