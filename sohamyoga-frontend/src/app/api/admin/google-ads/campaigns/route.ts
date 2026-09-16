import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEMO_CAMPAIGNS = [
  {
    id: 'demo-001', name: 'Brand Awareness — Yoga', status: 'active', type: 'search',
    budget: 50, impressions: 12400, clicks: 348, ctr: 2.81, cpc: 1.44,
    conversions: 18, spend: 501.12, startDate: '2026-09-01',
  },
  {
    id: 'demo-002', name: 'Retargeting — Visitors', status: 'active', type: 'display',
    budget: 30, impressions: 43200, clicks: 216, ctr: 0.50, cpc: 0.92,
    conversions: 9, spend: 198.72, startDate: '2026-09-05',
  },
  {
    id: 'demo-003', name: 'Class Sign-up — Search', status: 'paused', type: 'search',
    budget: 75, impressions: 8900, clicks: 267, ctr: 3.00, cpc: 2.10,
    conversions: 22, spend: 560.70, startDate: '2026-08-15',
  },
];

export async function GET(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  void principal;

  const configured = !!(process.env.GOOGLE_ADS_DEVELOPER_TOKEN);
  if (!configured) {
    return Response.json({
      demo: true,
      message: 'GOOGLE_ADS_DEVELOPER_TOKEN not set — showing demo data. Configure credentials to see real campaigns.',
      campaigns: DEMO_CAMPAIGNS,
    });
  }

  // Real path: would call Google Ads API client. Not wired — returning empty until credentials provided.
  const rows = await query(
    `SELECT id, name, status, campaign_type as type, daily_budget_cents/100.0 as budget,
            impressions, clicks,
            CASE WHEN impressions > 0 THEN ROUND((clicks::numeric/impressions)*100, 2) ELSE 0 END as ctr,
            CASE WHEN clicks > 0 THEN ROUND((daily_budget_cents::numeric/100/clicks), 2) ELSE 0 END as cpc,
            0 as conversions, 0 as spend, start_date as "startDate"
     FROM ad_campaign WHERE platform = 'google_ads' ORDER BY created_at DESC`,
    [],
  );

  return Response.json({ demo: false, campaigns: rows.rows });
}
