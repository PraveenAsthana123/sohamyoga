import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  void principal;

  const { searchParams } = new URL(req.url);
  const days = Math.min(Number(searchParams.get('days') ?? 30), 365);
  const configured = !!(process.env.GOOGLE_ADS_DEVELOPER_TOKEN);

  if (!configured) {
    // Demo report data
    const totalSpend = 1260.54;
    const totalImpressions = 64500;
    const totalClicks = 831;
    const totalConversions = 49;
    return Response.json({
      demo: true,
      message: 'GOOGLE_ADS_DEVELOPER_TOKEN not set — demo report data.',
      period: { days },
      summary: {
        spend: totalSpend,
        impressions: totalImpressions,
        clicks: totalClicks,
        ctr: parseFloat(((totalClicks / totalImpressions) * 100).toFixed(2)),
        cpc: parseFloat((totalSpend / totalClicks).toFixed(2)),
        conversions: totalConversions,
        roas: parseFloat(((totalConversions * 45) / totalSpend).toFixed(2)),
      },
      byCampaign: [
        { id: 'demo-001', name: 'Brand Awareness — Yoga',   spend: 501.12, impressions: 12400, clicks: 348, conversions: 18, roas: 1.62 },
        { id: 'demo-002', name: 'Retargeting — Visitors',   spend: 198.72, impressions: 43200, clicks: 216, conversions: 9,  roas: 2.04 },
        { id: 'demo-003', name: 'Class Sign-up — Search',   spend: 560.70, impressions: 8900,  clicks: 267, conversions: 22, roas: 1.77 },
      ],
      byKeyword: [
        { keyword: 'yoga classes near me', spend: 210.00, clicks: 174, conversions: 11, cpc: 1.21 },
        { keyword: 'online yoga studio',   spend: 157.50, clicks: 166, conversions: 9,  cpc: 0.95 },
        { keyword: 'hot yoga classes',     spend: 130.00, clicks: 87,  conversions: 7,  cpc: 1.49 },
      ],
    });
  }

  // Real path: query local ad_campaign + ad_analytics tables for Google Ads platform.
  const rows = await query(
    `SELECT c.id, c.name,
            COALESCE(SUM(a.spend_cents)/100.0, 0)::numeric(10,2) as spend,
            COALESCE(SUM(a.impressions), 0) as impressions,
            COALESCE(SUM(a.clicks), 0) as clicks,
            COALESCE(SUM(a.conversions), 0) as conversions
     FROM ad_campaign c
     LEFT JOIN ad_analytics a ON a.campaign_id = c.id AND a.recorded_at >= NOW() - INTERVAL '${days} days'
     WHERE c.platform = 'google_ads'
     GROUP BY c.id, c.name
     ORDER BY spend DESC`,
    [],
  );

  const total = rows.rows.reduce((acc, r) => ({
    spend: acc.spend + Number(r.spend),
    impressions: acc.impressions + Number(r.impressions),
    clicks: acc.clicks + Number(r.clicks),
    conversions: acc.conversions + Number(r.conversions),
  }), { spend: 0, impressions: 0, clicks: 0, conversions: 0 });

  return Response.json({
    demo: false,
    period: { days },
    summary: {
      ...total,
      ctr: total.impressions ? parseFloat(((total.clicks / total.impressions) * 100).toFixed(2)) : 0,
      cpc: total.clicks ? parseFloat((total.spend / total.clicks).toFixed(2)) : 0,
      roas: total.spend ? parseFloat(((total.conversions * 45) / total.spend).toFixed(2)) : 0,
    },
    byCampaign: rows.rows.map(r => ({
      ...r,
      roas: Number(r.spend) ? parseFloat(((Number(r.conversions) * 45) / Number(r.spend)).toFixed(2)) : 0,
    })),
  });
}
