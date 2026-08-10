// AnalyticsAggregationJob — Daily 01:00 UTC
// Rolls up yesterday's campaign analytics: impressions, clicks, leads, bookings.
// Reads from Matomo (self-hosted) + local DB. No cloud calls.

import { Pool } from 'pg';

const db     = new Pool({ connectionString: process.env.DATABASE_URL });
const MATOMO = process.env.MATOMO_BASE_URL  ?? 'http://localhost:8080';
const SITE   = process.env.MATOMO_SITE_ID   ?? '1';
const TOKEN  = process.env.MATOMO_AUTH_TOKEN ?? '';

interface MatomoVisit {
  idGoal: string;
  nb_conversions: number;
}

async function fetchMatomoCampaign(utmCampaign: string, date: string) {
  const url = `${MATOMO}/index.php?module=API&method=Goals.get` +
    `&idSite=${SITE}&period=day&date=${date}` +
    `&segment=campaignName%3D%3D${encodeURIComponent(utmCampaign)}` +
    `&format=JSON&token_auth=${TOKEN}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    return res.json() as Promise<{ nb_visits?: number; nb_uniq_visitors?: number }>;
  } catch {
    return null;
  }
}

export async function run(): Promise<void> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];

  // Active campaigns
  const campaigns = await db.query<{
    id: string; tenant_id: string; utm_campaign: string;
  }>(`
    SELECT id, tenant_id, utm_campaign
    FROM campaign_brief
    WHERE status = 'active'
  `);

  for (const c of campaigns.rows) {
    // UTM click data from local utm_link table
    const clicks = await db.query<{ total_clicks: string; platform: string }>(`
      SELECT COALESCE(SUM(click_count), 0) AS total_clicks, 'all' AS platform
      FROM utm_link
      WHERE brief_id=$1
    `, [c.id]);

    // Lead captures from campaign_lead
    const leads = await db.query<{ count: string }>(`
      SELECT COUNT(*) FROM campaign_lead
      WHERE brief_id=$1 AND DATE(created_at)=$2
    `, [c.id, dateStr]);

    // Bookings attributed to this campaign
    const bookings = await db.query<{ count: string }>(`
      SELECT COUNT(*) FROM booking b
      JOIN campaign_lead cl ON cl.customer_id = b.student_id
      WHERE cl.brief_id=$1 AND DATE(b.created_at)=$2
    `, [c.id, dateStr]);

    // Matomo impressions (best-effort)
    const matomo = await fetchMatomoCampaign(c.utm_campaign, dateStr);

    await db.query(`
      INSERT INTO campaign_analytics
        (tenant_id, brief_id, analytics_date, platform,
         impressions, clicks, leads_captured, bookings, revenue_cad, spend_cad)
      VALUES ($1, $2, $3, 'all',
        $4, $5, $6, $7, 0, 0)
      ON CONFLICT (brief_id, analytics_date, platform) DO UPDATE SET
        impressions    = EXCLUDED.impressions,
        clicks         = EXCLUDED.clicks,
        leads_captured = EXCLUDED.leads_captured,
        bookings       = EXCLUDED.bookings,
        updated_at     = NOW() -- add this column if not present
    `, [
      c.tenant_id, c.id, dateStr,
      matomo?.nb_visits ?? 0,
      parseInt(clicks.rows[0]?.total_clicks ?? '0', 10),
      parseInt(leads.rows[0]?.count ?? '0', 10),
      parseInt(bookings.rows[0]?.count ?? '0', 10),
    ]);
  }

  console.log(`[analytics-aggregation] date=${dateStr} campaigns=${campaigns.rows.length}`);
  await db.end();
}
