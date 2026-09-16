export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

interface Campaign {
  id: string;
  name: string;
  campaign_type: string;
  status: string;
  daily_budget_cents: number;
  total_budget_cents: number;
  bidding_strategy: string;
  geo_targets: unknown;
  platform: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

interface AdGroup {
  id: string;
  campaign_id: string;
  campaign_name: string;
  name: string;
  status: string;
  default_bid_cents: number;
  created_at: string;
}

interface HealthFinding {
  id: string;
  campaign_id: string;
  finding_key: string;
  severity: string;
  summary: string;
  recommended_action: string;
  facts: unknown;
  status: string;
  created_at: string;
  resolved_at: string | null;
}

interface SpyResult {
  id: number;
  platform: string;
  competitor_name: string | null;
  ad_id: string | null;
  ad_type: string | null;
  ad_text: string | null;
  headline: string | null;
  cta: string | null;
  media_url: string | null;
  start_date: string | null;
  impressions_range: string | null;
  spend_range: string | null;
  target_countries: string | null;
  target_demographics: string | null;
  fetched_at: string;
  created_at: string;
}

interface Summary {
  totalCampaigns: number;
  activeCampaigns: number;
  totalDailyBudgetCents: number;
  totalAdGroups: number;
}

export async function GET(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const client = await pool.connect();
  try {
    const [campaignsRes, adGroupsRes, healthRes, spyRes] = await Promise.all([
      client.query<Campaign>(`
        SELECT id, name, campaign_type, status, daily_budget_cents, total_budget_cents,
               bidding_strategy, geo_targets, platform, start_date, end_date, created_at
        FROM ad_campaign
        ORDER BY created_at DESC
      `).catch(() => ({ rows: [] as Campaign[] })),

      client.query<AdGroup>(`
        SELECT ag.id, ag.campaign_id, c.name AS campaign_name, ag.name,
               ag.status, ag.default_bid_cents, ag.created_at
        FROM ad_group ag
        LEFT JOIN ad_campaign c ON c.id = ag.campaign_id
        ORDER BY ag.created_at DESC
      `).catch(() => ({ rows: [] as AdGroup[] })),

      client.query<HealthFinding>(`
        SELECT hf.id, hf.campaign_id, hf.finding_key, hf.severity, hf.summary,
               hf.recommended_action, hf.facts, hf.status, hf.created_at, hf.resolved_at
        FROM ad_campaign_health_finding hf
        ORDER BY hf.created_at DESC
        LIMIT 200
      `).catch(() => ({ rows: [] as HealthFinding[] })),

      client.query<SpyResult>(`
        SELECT id, platform, competitor_name, ad_id, ad_type, ad_text, headline,
               cta, media_url, start_date, impressions_range, spend_range,
               target_countries, target_demographics, fetched_at, created_at
        FROM ad_spy_result
        ORDER BY created_at DESC
        LIMIT 200
      `).catch(() => ({ rows: [] as SpyResult[] })),
    ]);

    const campaigns = campaignsRes.rows;
    const adGroups = adGroupsRes.rows;

    const summary: Summary = {
      totalCampaigns: campaigns.length,
      activeCampaigns: campaigns.filter((c) => c.status === 'active').length,
      totalDailyBudgetCents: campaigns.reduce((sum, c) => sum + (c.daily_budget_cents ?? 0), 0),
      totalAdGroups: adGroups.length,
    };

    return Response.json({
      campaigns,
      adGroups,
      healthFindings: healthRes.rows,
      spyResults: spyRes.rows,
      summary,
    });
  } finally {
    client.release();
  }
}
