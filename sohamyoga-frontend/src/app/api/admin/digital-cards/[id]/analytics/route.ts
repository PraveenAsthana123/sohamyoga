import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const pool = getPool();
  try {
    const { searchParams } = new URL(req.url);
    const days = Math.min(parseInt(searchParams.get('days') || '30', 10), 90);

    const [dailyViews, actionBreakdown, topLinks, deviceBreakdown, referrerBreakdown, geoBreakdown, totalStats] =
      await Promise.all([
        // Daily views trend
        pool.query(`
          SELECT
            DATE(created_at) AS day,
            COUNT(*) FILTER (WHERE action = 'view') AS views,
            COUNT(*) FILTER (WHERE action = 'save_contact') AS saves,
            COUNT(*) FILTER (WHERE action = 'share') AS shares,
            COUNT(*) AS total_events
          FROM digital_card_views
          WHERE card_id = $1 AND created_at >= NOW() - ($2 || ' days')::interval
          GROUP BY DATE(created_at)
          ORDER BY day ASC
        `, [params.id, days]),

        // Action breakdown
        pool.query(`
          SELECT action, COUNT(*) AS cnt
          FROM digital_card_views
          WHERE card_id = $1 AND created_at >= NOW() - ($2 || ' days')::interval
          GROUP BY action
          ORDER BY cnt DESC
        `, [params.id, days]),

        // Top clicked elements (social + custom links)
        pool.query(`
          SELECT
            element_clicked AS element,
            COUNT(*) AS clicks
          FROM digital_card_views
          WHERE card_id = $1
            AND element_clicked IS NOT NULL
            AND created_at >= NOW() - ($2 || ' days')::interval
          GROUP BY element_clicked
          ORDER BY clicks DESC
          LIMIT 10
        `, [params.id, days]),

        // Device breakdown
        pool.query(`
          SELECT
            COALESCE(device_type, 'unknown') AS device,
            COUNT(*) AS cnt,
            ROUND(COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0), 1) AS pct
          FROM digital_card_views
          WHERE card_id = $1 AND created_at >= NOW() - ($2 || ' days')::interval
          GROUP BY device_type
          ORDER BY cnt DESC
        `, [params.id, days]),

        // Referrer breakdown
        pool.query(`
          SELECT
            COALESCE(referrer, 'direct') AS referrer,
            COUNT(*) AS cnt
          FROM digital_card_views
          WHERE card_id = $1 AND created_at >= NOW() - ($2 || ' days')::interval
          GROUP BY referrer
          ORDER BY cnt DESC
          LIMIT 10
        `, [params.id, days]),

        // Geographic breakdown
        pool.query(`
          SELECT
            COALESCE(country, 'Unknown') AS country,
            COUNT(*) AS cnt
          FROM digital_card_views
          WHERE card_id = $1 AND created_at >= NOW() - ($2 || ' days')::interval
          GROUP BY country
          ORDER BY cnt DESC
          LIMIT 10
        `, [params.id, days]),

        // Total stats + viral coefficient
        pool.query(`
          SELECT
            COUNT(*) FILTER (WHERE action = 'view') AS total_views,
            COUNT(*) FILTER (WHERE action = 'contact_click') AS total_contact_clicks,
            COUNT(*) FILTER (WHERE action = 'social_click') AS total_social_clicks,
            COUNT(*) FILTER (WHERE action = 'save_contact') AS total_saves,
            COUNT(*) FILTER (WHERE action = 'share') AS total_shares,
            COUNT(*) FILTER (WHERE action = 'qr_scan') AS total_qr_scans,
            ROUND(
              COUNT(*) FILTER (WHERE action = 'share')::numeric /
              NULLIF(COUNT(*) FILTER (WHERE action = 'view'), 0),
              4
            ) AS viral_coefficient
          FROM digital_card_views
          WHERE card_id = $1 AND created_at >= NOW() - ($2 || ' days')::interval
        `, [params.id, days]),
      ]);

    return Response.json({
      period_days: days,
      total_stats: totalStats.rows[0],
      daily_views: dailyViews.rows,
      action_breakdown: actionBreakdown.rows,
      top_links: topLinks.rows,
      device_breakdown: deviceBreakdown.rows,
      referrer_breakdown: referrerBreakdown.rows,
      geo_breakdown: geoBreakdown.rows,
    });
  } catch (err) {
    console.error('[digital-cards/[id]/analytics GET]', err);
    return Response.json({ error: 'Failed to load analytics.' }, { status: 500 });
  }
}
