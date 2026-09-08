import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin, getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CAMPAIGN_TYPES = ['search', 'display', 'video', 'shopping', 'app'];
const PLATFORMS = ['google_ads', 'meta_ads', 'tiktok_ads', 'linkedin_ads', 'snapchat_ads', 'other'];

// Real campaign creation — the admin page's "+ New Campaign" button
// previously had no onClick handler at all (confirmed via a deep audit:
// grep found only 2 INSERT INTO ad_campaign call sites in the whole repo,
// a demo seeder and a health-audit job, neither a real user-facing path).
export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { name?: string; campaignType?: string; platform?: string; dailyBudget?: number; startDate?: string; endDate?: string } | null;
  if (!body?.name || !CAMPAIGN_TYPES.includes(body.campaignType ?? '')) {
    return Response.json({ error: `name and a valid campaignType (${CAMPAIGN_TYPES.join('|')}) are required.` }, { status: 400 });
  }
  if (body.platform && !PLATFORMS.includes(body.platform)) {
    return Response.json({ error: `platform must be one of ${PLATFORMS.join('|')}.` }, { status: 400 });
  }
  const dailyBudgetCents = Math.round((body.dailyBudget ?? 0) * 100);
  if (!Number.isInteger(dailyBudgetCents) || dailyBudgetCents < 1) {
    return Response.json({ error: 'dailyBudget must be a positive number.' }, { status: 400 });
  }
  const startDate = body.startDate || new Date().toISOString().slice(0, 10);
  if (body.endDate && body.endDate < startDate) {
    return Response.json({ error: 'endDate cannot be before startDate.' }, { status: 400 });
  }

  const result = await query(
    `INSERT INTO ad_campaign (name, campaign_type, platform, daily_budget_cents, start_date, end_date, created_by, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'draft') RETURNING id, name, campaign_type::text, platform::text, status::text, daily_budget_cents, start_date, end_date`,
    [body.name, body.campaignType, body.platform ?? 'google_ads', dailyBudgetCents, startDate, body.endDate || null, principal?.email ?? 'admin'],
  );
  return Response.json({ campaign: result.rows[0] }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const status = req.nextUrl.searchParams.get('status');
  const base = `
    SELECT c.id, c.name, c.campaign_type::text, c.platform::text, c.status::text, c.daily_budget_cents,
           c.start_date, c.end_date,
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
        id: c.id, name: c.name, type: c.campaign_type, platform: c.platform, status: c.status,
        budget: c.daily_budget_cents / 100,
        startDate: c.start_date, endDate: c.end_date,
        impressions, clicks,
        ctr: impressions ? Math.round((clicks / impressions) * 10000) / 100 : 0,
        cpc: clicks ? Math.round((spend / clicks) * 100) / 100 : 0,
      };
    }),
  });
}
