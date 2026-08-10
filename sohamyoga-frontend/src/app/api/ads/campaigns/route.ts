import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const status = req.nextUrl.searchParams.get('status');
  const base = `
    SELECT c.id, c.name, c.campaign_type::text, c.status::text, c.daily_budget_cents,
           COALESCE(SUM(a.impression_count),0) AS impressions,
           COALESCE(SUM(a.click_count),0) AS clicks,
           COALESCE(SUM(a.spend_cents),0) AS spend_cents
    FROM ad_campaign c
    LEFT JOIN ad_group g ON g.campaign_id = c.id
    LEFT JOIN advertisement a ON a.ad_group_id = g.id`;
  const rows = status && status !== 'all'
    ? await query(`${base} WHERE c.status = $1 GROUP BY c.id ORDER BY c.created_at DESC`, [status])
    : await query(`${base} GROUP BY c.id ORDER BY c.created_at DESC`);

  return Response.json({
    campaigns: rows.rows.map((c) => {
      const impressions = Number(c.impressions);
      const clicks = Number(c.clicks);
      const spend = Number(c.spend_cents) / 100;
      return {
        id: c.id, name: c.name, type: c.campaign_type, status: c.status,
        budget: c.daily_budget_cents / 100,
        impressions, clicks,
        ctr: impressions ? Math.round((clicks / impressions) * 10000) / 100 : 0,
        cpc: clicks ? Math.round((spend / clicks) * 100) / 100 : 0,
      };
    }),
  });
}
