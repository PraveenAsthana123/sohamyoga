import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const [counts, totals, byType] = await Promise.all([
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
  ]);

  const totalRow = totals.rows[0];
  const impressions = Number(totalRow?.impressions ?? 0);
  const clicks = Number(totalRow?.clicks ?? 0);
  const conversions = Number(totalRow?.conversions ?? 0);
  const spendCents = Number(totalRow?.spend_cents ?? 0);
  const totalSpendByType = byType.rows.reduce((s, r) => s + Number(r.spend_cents), 0);

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
    },
    spendByType: byType.rows.map(r => ({
      type: r.campaign_type,
      spend: Number(r.spend_cents) / 100,
      pct: totalSpendByType ? Math.round((Number(r.spend_cents) / totalSpendByType) * 100) : 0,
    })),
  });
}
