import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const today = new Date().toISOString().split('T')[0];

  // Today's engagement counts
  const todayStats = await query(`
    SELECT
      COUNT(*) FILTER (WHERE event_type = 'impression') as impressions,
      COUNT(*) FILTER (WHERE event_type = 'click') as clicks,
      COUNT(*) FILTER (WHERE event_type = 'conversion') as conversions
    FROM ad_engagement
    WHERE created_at::date = $1
  `, [today]);

  // Reaction totals (all time)
  const reactions = await query(`
    SELECT emoji_reaction, COUNT(*) as count
    FROM ad_engagement
    WHERE event_type IN ('like','love','haha','wow','sad','angry') AND emoji_reaction IS NOT NULL
    GROUP BY emoji_reaction
    ORDER BY count DESC
  `);

  // Leads today from campaign_lead
  const leadsToday = await query(`
    SELECT COUNT(*) as count FROM campaign_lead WHERE created_at::date = $1
  `, [today]);

  // Plans by status
  const planStatus = await query(`
    SELECT status, COUNT(*) as count FROM ad_post_plan GROUP BY status
  `);

  // Upcoming plans (next 5)
  const upcoming = await query(`
    SELECT id, headline, platform, scheduled_at, status, ad_message_type
    FROM ad_post_plan
    WHERE scheduled_at >= now() AND status IN ('scheduled','draft')
    ORDER BY scheduled_at ASC
    LIMIT 5
  `);

  // Draft queue
  const drafts = await query(`
    SELECT id, headline, platform, created_at, ad_message_type
    FROM ad_post_plan
    WHERE status = 'draft'
    ORDER BY created_at DESC
    LIMIT 10
  `);

  // 30-day engagement trend
  const trend = await query(`
    SELECT
      DATE_TRUNC('day', created_at)::date as date,
      COUNT(*) FILTER (WHERE event_type = 'impression') as impressions,
      COUNT(*) FILTER (WHERE event_type = 'click') as clicks
    FROM ad_engagement
    WHERE created_at >= now() - interval '30 days'
    GROUP BY DATE_TRUNC('day', created_at)
    ORDER BY date ASC
  `);

  // Platform performance from ad_analytics
  const platformPerf = await query(`
    SELECT
      ac.platform,
      SUM(aa.impressions) as impressions,
      SUM(aa.clicks) as clicks,
      SUM(aa.conversions) as conversions,
      SUM(aa.spend_cents) as spend_cents,
      AVG(aa.ctr)::numeric(5,2) as avg_ctr,
      AVG(aa.roas)::numeric(5,2) as avg_roas
    FROM ad_analytics aa
    JOIN ad_campaign ac ON ac.id = aa.campaign_id
    WHERE aa.date >= now() - interval '30 days'
    GROUP BY ac.platform
  `);

  const todayRow = todayStats.rows[0];
  const impressions = parseInt(todayRow.impressions || '0');
  const clicks = parseInt(todayRow.clicks || '0');
  const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '0.00';

  return Response.json({
    today: {
      impressions,
      clicks,
      conversions: parseInt(todayRow.conversions || '0'),
      leads: parseInt(leadsToday.rows[0].count || '0'),
      ctr: parseFloat(ctr)
    },
    reactions: reactions.rows,
    planStatus: planStatus.rows,
    upcoming: upcoming.rows,
    drafts: drafts.rows,
    trend: trend.rows,
    platformPerf: platformPerf.rows
  });
}
