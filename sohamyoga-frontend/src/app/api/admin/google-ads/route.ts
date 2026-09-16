export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

// ── GET — overview: campaign summary + top-level metrics from local DB ─────────

export async function GET(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const configured = !!(process.env.GOOGLE_ADS_DEVELOPER_TOKEN);
  const client = await pool.connect();
  try {
    const [campaigns, analytics] = await Promise.all([
      client.query(`
        SELECT id, name, campaign_type, status, daily_budget_cents, platform,
               start_date, created_at
        FROM ad_campaign
        WHERE platform = 'google_ads'
        ORDER BY created_at DESC
        LIMIT 50
      `).catch(() => ({ rows: [] as Record<string, unknown>[] })),
      client.query(`
        SELECT
          COALESCE(SUM(impressions), 0)::bigint     AS impressions,
          COALESCE(SUM(clicks), 0)::bigint          AS clicks,
          COALESCE(SUM(leads_captured), 0)::bigint  AS leads,
          COALESCE(SUM(spend_cad), 0)::numeric(14,2) AS spend_cad
        FROM campaign_analytics
        WHERE platform = 'google'
          AND analytics_date >= NOW() - INTERVAL '30 days'
      `).catch(() => ({ rows: [{ impressions: 0, clicks: 0, leads: 0, spend_cad: 0 }] })),
    ]);

    const ag = analytics.rows[0] ?? {};
    const impr  = Number(ag.impressions ?? 0);
    const clicks = Number(ag.clicks ?? 0);

    return NextResponse.json({
      configured,
      summary: {
        campaignCount: campaigns.rows.length,
        activeCampaigns: campaigns.rows.filter((c: Record<string, unknown>) => c.status === 'active').length,
        impressions30d: impr,
        clicks30d: clicks,
        leads30d: Number(ag.leads ?? 0),
        spendCad30d: Number(ag.spend_cad ?? 0),
        ctr30d: impr > 0 ? parseFloat(((clicks / impr) * 100).toFixed(2)) : 0,
      },
      campaigns: campaigns.rows,
      tables: ['ad_campaign', 'campaign_analytics', 'campaign_brief'],
      note: configured
        ? 'Google Ads credentials found. Real API sync available via GoogleAdsSyncJob.'
        : 'GOOGLE_ADS_DEVELOPER_TOKEN not set. Data shown is from local DB only. Sub-routes return demo data when unconfigured.',
    });
  } finally {
    client.release();
  }
}

// ── POST ?action=insight — Ollama AI insight over campaigns ───────────────────

interface OllamaResponse {
  response?: string;
  message?: { content?: string };
  error?: string;
}

export async function POST(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  if (action !== 'insight') {
    return NextResponse.json({ error: 'Only action=insight is supported' }, { status: 400 });
  }

  // Gather current campaign snapshot for context
  const client = await pool.connect();
  let context = '';
  try {
    const [campaigns, analytics] = await Promise.all([
      client.query(`
        SELECT name, campaign_type, status, daily_budget_cents/100.0 AS daily_budget
        FROM ad_campaign WHERE platform = 'google_ads' LIMIT 10
      `).catch(() => ({ rows: [] as Record<string, unknown>[] })),
      client.query(`
        SELECT
          COALESCE(SUM(impressions), 0) AS impressions,
          COALESCE(SUM(clicks), 0) AS clicks,
          COALESCE(SUM(leads_captured), 0) AS leads,
          COALESCE(SUM(spend_cad), 0) AS spend
        FROM campaign_analytics
        WHERE platform = 'google' AND analytics_date >= NOW() - INTERVAL '30 days'
      `).catch(() => ({ rows: [] as Record<string, unknown>[] })),
    ]);

    const ag = analytics.rows[0] ?? {};
    context = `Google Ads campaigns: ${JSON.stringify(campaigns.rows.slice(0, 5))}. ` +
      `30-day analytics: impressions=${ag.impressions ?? 0}, clicks=${ag.clicks ?? 0}, ` +
      `leads=${ag.leads ?? 0}, spend_cad=${ag.spend ?? 0}.`;
  } finally {
    client.release();
  }

  const ollamaBase = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  const prompt =
    `You are a Google Ads specialist. Based on the following data, provide 3 concise, actionable ` +
    `optimization insights for a yoga studio's Google Ads account. Focus on CTR improvement, ` +
    `bid strategy, and keyword expansion.\n\nData: ${context}\n\n` +
    `Format each insight as a numbered point (1-3), one sentence each.`;

  try {
    const ollamaRes = await fetch(`${ollamaBase}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!ollamaRes.ok) {
      return NextResponse.json({ error: `Ollama returned ${ollamaRes.status}` }, { status: 502 });
    }

    const data = await ollamaRes.json() as OllamaResponse;
    const insight = data.response ?? data.message?.content ?? 'No insight generated.';
    return NextResponse.json({ insight, context });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Ollama unreachable';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
