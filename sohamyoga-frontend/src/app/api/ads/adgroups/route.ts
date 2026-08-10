import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const rows = await query<{
    id: string; name: string; status: string; campaign_name: string; default_bid_cents: number;
    keyword_count: string; ad_count: string; impressions: string; clicks: string;
  }>(
    `SELECT g.id, g.name, g.status::text, c.name AS campaign_name, g.default_bid_cents,
            (SELECT COUNT(*) FROM ad_keyword k WHERE k.ad_group_id = g.id) AS keyword_count,
            (SELECT COUNT(*) FROM advertisement a WHERE a.ad_group_id = g.id) AS ad_count,
            COALESCE((SELECT SUM(impression_count) FROM advertisement a WHERE a.ad_group_id = g.id), 0) AS impressions,
            COALESCE((SELECT SUM(click_count) FROM advertisement a WHERE a.ad_group_id = g.id), 0) AS clicks
     FROM ad_group g JOIN ad_campaign c ON c.id = g.campaign_id
     ORDER BY g.created_at DESC`,
  );

  return Response.json({
    adGroups: rows.rows.map(g => {
      const impressions = Number(g.impressions);
      const clicks = Number(g.clicks);
      return {
        id: g.id, name: g.name, campaign: g.campaign_name, status: g.status,
        keywords: Number(g.keyword_count), ads: Number(g.ad_count),
        bid: g.default_bid_cents / 100,
        ctr: impressions ? Math.round((clicks / impressions) * 10000) / 100 : 0,
      };
    }),
  });
}
