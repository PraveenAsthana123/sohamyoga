// GET /api/analytics/dashboard — real KPIs for the admin Analytics "Overview" tab.
// Reads tracking_session/tracking_event directly (views v_daily_visitors and
// v_conversion_events cover a fixed GROUP BY DATE(...) shape that doesn't fit a
// "last 30 days" rollup cleanly, so this aggregates the base tables instead).

import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const [kpis, traffic, conversions] = await Promise.all([
    query<{
      unique_visitors: string; total_sessions: string; page_views: string;
      avg_duration_minutes: string | null; bounce_rate_pct: string | null;
    }>(
      `SELECT
         COUNT(DISTINCT anonymous_id) AS unique_visitors,
         COUNT(*) AS total_sessions,
         COALESCE(SUM(page_count), 0) AS page_views,
         AVG(EXTRACT(EPOCH FROM (COALESCE(ended_at, last_seen_at) - started_at)) / 60) AS avg_duration_minutes,
         ROUND(
           COUNT(*) FILTER (WHERE page_count <= 1 AND status = 'ended')::NUMERIC
           / NULLIF(COUNT(*) FILTER (WHERE status = 'ended'), 0) * 100, 2
         ) AS bounce_rate_pct
       FROM tracking_session
       WHERE started_at >= now() - interval '30 days'`,
    ),
    query<{ source: string | null; count: string }>(
      `SELECT COALESCE(traffic_source::text, 'direct') AS source, COUNT(*) AS count
       FROM tracking_session WHERE started_at >= now() - interval '30 days'
       GROUP BY 1 ORDER BY count DESC`,
    ),
    query<{ event_type: string; count: string }>(
      `SELECT event_type::text, COUNT(*) AS count FROM tracking_event
       WHERE created_at >= CURRENT_DATE AND status = 'collected'
       GROUP BY event_type`,
    ),
  ]);

  const errors = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM tracking_event WHERE event_type = 'error' AND created_at >= now() - interval '7 days'`,
  );

  const row = kpis.rows[0];
  const totalTraffic = traffic.rows.reduce((sum, r) => sum + Number(r.count), 0);

  return Response.json({
    kpis: {
      uniqueVisitors: Number(row?.unique_visitors ?? 0),
      totalSessions: Number(row?.total_sessions ?? 0),
      pageViews: Number(row?.page_views ?? 0),
      avgSessionMinutes: row?.avg_duration_minutes ? Number(row.avg_duration_minutes) : 0,
      bounceRatePct: row?.bounce_rate_pct ? Number(row.bounce_rate_pct) : 0,
      jsErrors7d: Number(errors.rows[0]?.count ?? 0),
    },
    trafficSources: traffic.rows.map(r => ({
      source: r.source ?? 'direct',
      count: Number(r.count),
      pct: totalTraffic ? Math.round((Number(r.count) / totalTraffic) * 100) : 0,
    })),
    conversionsToday: Object.fromEntries(conversions.rows.map(r => [r.event_type, Number(r.count)])),
  });
}
