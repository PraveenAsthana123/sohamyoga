import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureSchema() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS meta_ad_campaigns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id TEXT UNIQUE,
      campaign_name TEXT NOT NULL,
      objective TEXT,
      status TEXT DEFAULT 'ACTIVE',
      daily_budget NUMERIC(10,2),
      lifetime_budget NUMERIC(10,2),
      spend NUMERIC(12,2) DEFAULT 0,
      impressions INT DEFAULT 0,
      clicks INT DEFAULT 0,
      ctr NUMERIC(6,4),
      cpm NUMERIC(8,2),
      cpc NUMERIC(8,2),
      conversions INT DEFAULT 0,
      cost_per_conversion NUMERIC(10,2),
      roas NUMERIC(6,3),
      start_date DATE,
      end_date DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const pool = getPool();
    await ensureSchema();

    const { rows } = await pool.query(
      `SELECT * FROM meta_ad_campaigns ORDER BY created_at DESC`
    );

    const totalSpend = rows.reduce((s: number, c: Record<string, unknown>) => s + (Number(c.spend) || 0), 0);
    const totalImpressions = rows.reduce((s: number, c: Record<string, unknown>) => s + (Number(c.impressions) || 0), 0);
    const totalClicks = rows.reduce((s: number, c: Record<string, unknown>) => s + (Number(c.clicks) || 0), 0);
    const totalConversions = rows.reduce((s: number, c: Record<string, unknown>) => s + (Number(c.conversions) || 0), 0);
    const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    const roasValues = rows.filter((c: Record<string, unknown>) => c.roas).map((c: Record<string, unknown>) => Number(c.roas));
    const avgRoas = roasValues.length ? roasValues.reduce((a, b) => a + b, 0) / roasValues.length : 0;

    const budgetAlerts = rows
      .filter((c: Record<string, unknown>) => {
        const lb = Number(c.lifetime_budget);
        const sp = Number(c.spend);
        return lb > 0 && sp / lb > 0.9;
      })
      .map((c: Record<string, unknown>) => c.campaign_id);

    return Response.json({
      campaigns: rows,
      kpi: {
        totalSpend: Number(totalSpend.toFixed(2)),
        totalImpressions,
        avgCtr: Number(avgCtr.toFixed(4)),
        totalConversions,
        avgRoas: Number(avgRoas.toFixed(3)),
      },
      budgetAlerts,
      demo: !process.env.META_PAGE_ACCESS_TOKEN,
    });
  } catch (err) {
    console.error('[meta-ads GET]', err);
    return Response.json({ error: 'Failed to load ad campaigns' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const pool = getPool();
    await ensureSchema();

    const body = await req.json() as {
      campaign_name: string;
      objective: string;
      daily_budget?: number;
      lifetime_budget?: number;
      start_date?: string;
      end_date?: string;
    };

    if (!body.campaign_name || !body.objective) {
      return Response.json({ error: 'campaign_name and objective are required' }, { status: 400 });
    }

    const VALID_OBJECTIVES = ['AWARENESS', 'TRAFFIC', 'ENGAGEMENT', 'LEADS', 'SALES', 'APP_PROMOTION', 'CONVERSIONS'];
    if (!VALID_OBJECTIVES.includes(body.objective)) {
      return Response.json({ error: `Invalid objective. Valid: ${VALID_OBJECTIVES.join(', ')}` }, { status: 400 });
    }

    const campaignId = `camp_${Date.now()}`;
    let metaApiResult: Record<string, unknown> | null = null;
    const token = process.env.META_PAGE_ACCESS_TOKEN;
    const adAccountId = process.env.META_AD_ACCOUNT_ID;

    if (token && adAccountId) {
      try {
        const metaRes = await fetch(
          `https://graph.facebook.com/v18.0/act_${adAccountId}/campaigns`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: body.campaign_name,
              objective: body.objective,
              status: 'PAUSED',
              daily_budget: body.daily_budget ? Math.round(body.daily_budget * 100) : undefined,
              access_token: token,
            }),
            signal: AbortSignal.timeout(10000),
          }
        );
        if (metaRes.ok) metaApiResult = await metaRes.json() as Record<string, unknown>;
      } catch { /* save to DB only */ }
    }

    const { rows } = await pool.query(
      `INSERT INTO meta_ad_campaigns (campaign_id, campaign_name, objective, status, daily_budget, lifetime_budget, start_date, end_date)
       VALUES ($1, $2, $3, 'PAUSED', $4, $5, $6, $7)
       RETURNING *`,
      [
        metaApiResult?.id || campaignId,
        body.campaign_name,
        body.objective,
        body.daily_budget || null,
        body.lifetime_budget || null,
        body.start_date || null,
        body.end_date || null,
      ]
    );

    return Response.json({
      campaign: rows[0],
      metaApiResult,
      warning: !token ? 'Campaign saved locally — connect Meta Ads credentials to sync to Meta.' : undefined,
    }, { status: 201 });
  } catch (err) {
    console.error('[meta-ads POST]', err);
    return Response.json({ error: 'Failed to create campaign' }, { status: 500 });
  }
}
