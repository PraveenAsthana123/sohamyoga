import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real gap fixed: no POST existed to create an ad group via the UI --
// found live during the 2026-09-01 paid-ads verification (module_registry
// disclosed it as a structural gap). Mirrors the real POST /api/ads/campaigns
// pattern (same validation/auth/insert shape). No created_by column exists
// on ad_group (confirmed against the real db-schema.sql), unlike ad_campaign.
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { campaignId?: string; name?: string; defaultBid?: number } | null;
  if (!body?.campaignId || !body.name) {
    return Response.json({ error: 'campaignId and name are required.' }, { status: 400 });
  }
  const campaign = await query<{ id: string }>(`SELECT id FROM ad_campaign WHERE id = $1`, [body.campaignId]);
  if (campaign.rows.length === 0) {
    return Response.json({ error: 'campaignId does not reference a real campaign.' }, { status: 400 });
  }
  const defaultBidCents = Math.round((body.defaultBid ?? 1) * 100);
  if (!Number.isInteger(defaultBidCents) || defaultBidCents < 1) {
    return Response.json({ error: 'defaultBid must be a positive number.' }, { status: 400 });
  }

  const result = await query<{ id: string; name: string; status: string; default_bid_cents: number }>(
    `INSERT INTO ad_group (campaign_id, name, default_bid_cents, status)
     VALUES ($1,$2,$3,'active') RETURNING id, name, status::text, default_bid_cents`,
    [body.campaignId, body.name, defaultBidCents],
  );
  return Response.json({ adGroup: result.rows[0] }, { status: 201 });
}

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
