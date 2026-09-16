import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export async function GET() {
  try {
    const res = await query<{
      platform: string; status: string; item_type: string; cnt: string;
      total_impressions: string; total_reach: string; total_spend: string;
      total_revenue: string; avg_roas: string;
    }>(`
      SELECT
        platform, status, item_type,
        COUNT(*) as cnt,
        SUM(impressions) as total_impressions,
        SUM(reach) as total_reach,
        SUM(spend) as total_spend,
        SUM(revenue) as total_revenue,
        AVG(NULLIF(roas, 0)) as avg_roas
      FROM unified_content_item
      WHERE status != 'deleted'
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY platform, status, item_type
      ORDER BY platform, status
    `);

    const byPlatform: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let totalImpressions = 0;
    let totalReach = 0;
    let totalSpend = 0;
    let totalRevenue = 0;

    for (const r of res.rows) {
      const cnt = parseInt(r.cnt, 10);
      byPlatform[r.platform] = (byPlatform[r.platform] ?? 0) + cnt;
      byStatus[r.status] = (byStatus[r.status] ?? 0) + cnt;
      totalImpressions += parseInt(r.total_impressions ?? '0', 10);
      totalReach += parseInt(r.total_reach ?? '0', 10);
      totalSpend += parseFloat(r.total_spend ?? '0');
      totalRevenue += parseFloat(r.total_revenue ?? '0');
    }

    return NextResponse.json({
      by_platform: byPlatform,
      by_status: byStatus,
      total_impressions: totalImpressions,
      total_reach: totalReach,
      total_spend: totalSpend,
      total_revenue: totalRevenue,
      total_roas: totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(2) : '0',
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
