// GET /api/analytics/attribution — which channel/campaign actually drove
// conversions. Last-touch: joins conversion events (booking_completed,
// payment_completed, subscription_started) back to the tracking_session
// that produced them, grouping by UTM campaign where present, falling back
// to traffic_source. Real join, not a static UTM-link-click count.

import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const days = Math.min(Number(req.nextUrl.searchParams.get('days')) || 30, 90);

  const byChannel = await query<{ channel: string; conversions: string; unique_sessions: string }>(
    `SELECT COALESCE(s.traffic_source::text, 'direct') AS channel,
            COUNT(*) AS conversions, COUNT(DISTINCT e.session_id) AS unique_sessions
     FROM tracking_event e JOIN tracking_session s ON s.id = e.session_id
     WHERE e.event_type IN ('booking_completed','payment_completed','subscription_started')
       AND e.status = 'collected' AND e.created_at >= now() - ($1 || ' days')::interval
     GROUP BY 1 ORDER BY conversions DESC`,
    [days],
  );

  const byCampaign = await query<{ utm_campaign: string; utm_source: string | null; conversions: string }>(
    `SELECT s.utm_campaign, s.utm_source, COUNT(*) AS conversions
     FROM tracking_event e JOIN tracking_session s ON s.id = e.session_id
     WHERE e.event_type IN ('booking_completed','payment_completed','subscription_started')
       AND e.status = 'collected' AND e.created_at >= now() - ($1 || ' days')::interval
       AND s.utm_campaign IS NOT NULL
     GROUP BY s.utm_campaign, s.utm_source ORDER BY conversions DESC LIMIT 20`,
    [days],
  );

  const byEventType = await query<{ event_type: string; count: string }>(
    `SELECT event_type::text, COUNT(*) AS count FROM tracking_event
     WHERE event_type IN ('booking_completed','payment_completed','subscription_started')
       AND status = 'collected' AND created_at >= now() - ($1 || ' days')::interval
     GROUP BY event_type`,
    [days],
  );

  const totalConversions = byChannel.rows.reduce((s, r) => s + Number(r.conversions), 0);

  return Response.json({
    windowDays: days,
    totalConversions,
    byChannel: byChannel.rows.map(r => ({
      channel: r.channel, conversions: Number(r.conversions), uniqueSessions: Number(r.unique_sessions),
      pct: totalConversions ? Math.round((Number(r.conversions) / totalConversions) * 100) : 0,
    })),
    byCampaign: byCampaign.rows.map(r => ({
      campaign: r.utm_campaign, source: r.utm_source ?? 'unknown', conversions: Number(r.conversions),
    })),
    byEventType: Object.fromEntries(byEventType.rows.map(r => [r.event_type, Number(r.count)])),
  });
}
