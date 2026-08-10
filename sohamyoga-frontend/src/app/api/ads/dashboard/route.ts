import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const [counts, totals, byType, aiEngineRow] = await Promise.all([
    query<{ campaign_type: string; count: string }>(
      `SELECT campaign_type::text, COUNT(*) AS count FROM ad_campaign WHERE status = 'active' GROUP BY campaign_type`,
    ),
    query<{
      spend_cents: string; impressions: string; clicks: string; conversions: string;
    }>(
      `SELECT COALESCE(SUM(spend_cents),0) AS spend_cents, COALESCE(SUM(impression_count),0) AS impressions,
              COALESCE(SUM(click_count),0) AS clicks, COALESCE(SUM(conversion_count),0) AS conversions
       FROM advertisement`,
    ),
    query<{ campaign_type: string; spend_cents: string }>(
      `SELECT c.campaign_type::text, COALESCE(SUM(a.spend_cents),0) AS spend_cents
       FROM ad_campaign c
       JOIN ad_group g ON g.campaign_id = c.id
       JOIN advertisement a ON a.ad_group_id = g.id
       GROUP BY c.campaign_type`,
    ),
    // Real, currently-wired AI/automation surfaces in this domain only —
    // no fabricated usage counts for tools that aren't actually connected
    // (ComfyUI banner generation, GrowthBook A/B testing have no data source
    // here and are reported as not_connected rather than invented numbers).
    query<{ ads_generated: string; keyword_count: string; health_findings: string }>(
      `SELECT
         (SELECT COUNT(*) FROM advertisement WHERE ai_generated = TRUE) AS ads_generated,
         (SELECT COUNT(*) FROM ad_keyword) AS keyword_count,
         (SELECT COUNT(*) FROM ad_campaign_health_finding) AS health_findings`,
    ),
  ]);

  const totalRow = totals.rows[0];
  const impressions = Number(totalRow?.impressions ?? 0);
  const clicks = Number(totalRow?.clicks ?? 0);
  const conversions = Number(totalRow?.conversions ?? 0);
  const spendCents = Number(totalRow?.spend_cents ?? 0);
  const totalSpendByType = byType.rows.reduce((s, r) => s + Number(r.spend_cents), 0);
  const ai = aiEngineRow.rows[0];

  return Response.json({
    kpis: {
      activeCampaigns: counts.rows.reduce((s, r) => s + Number(r.count), 0),
      activeByType: Object.fromEntries(counts.rows.map(r => [r.campaign_type, Number(r.count)])),
      totalSpend: spendCents / 100,
      totalImpressions: impressions,
      totalClicks: clicks,
      conversions,
      avgCtrPct: impressions ? Math.round((clicks / impressions) * 10000) / 100 : 0,
      avgCpc: clicks ? Math.round((spendCents / 100 / clicks) * 100) / 100 : 0,
      avgCpm: impressions ? Math.round((spendCents / 100 / impressions) * 1000 * 100) / 100 : 0,
      avgCpa: conversions ? Math.round((spendCents / 100 / conversions) * 100) / 100 : 0,
    },
    funnel: { impressions, clicks, conversions },
    spendByType: byType.rows.map(r => ({
      type: r.campaign_type,
      spend: Number(r.spend_cents) / 100,
      pct: totalSpendByType ? Math.round((Number(r.spend_cents) / totalSpendByType) * 100) : 0,
    })),
    aiEngine: {
      adsGenerated: Number(ai?.ads_generated ?? 0),
      keywordCount: Number(ai?.keyword_count ?? 0),
      healthFindings: Number(ai?.health_findings ?? 0),
    },
  });
}
