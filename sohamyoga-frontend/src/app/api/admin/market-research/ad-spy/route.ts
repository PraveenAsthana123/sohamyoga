export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

interface AdSpyRow {
  id: number;
  platform: string;
  competitor_name: string | null;
  ad_id: string | null;
  ad_type: string | null;
  ad_text: string | null;
  headline: string | null;
  cta: string | null;
  media_url: string | null;
  start_date: string | null;
  impressions_range: string | null;
  spend_range: string | null;
  target_countries: string | null;
  target_demographics: string | null;
  raw_data: Record<string, unknown>;
  fetched_at: string;
  created_at: string;
}

// GET /api/admin/market-research/ad-spy?platform=facebook&competitor=Yoga
export async function GET(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const platform = searchParams.get('platform');
  const competitor = searchParams.get('competitor');

  const conditions: string[] = [];
  const params: string[] = [];

  if (platform) {
    params.push(platform);
    conditions.push(`platform = $${params.length}`);
  }
  if (competitor) {
    params.push(`%${competitor}%`);
    conditions.push(`competitor_name ILIKE $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query<AdSpyRow>(
    `SELECT * FROM ad_spy_result ${where} ORDER BY fetched_at DESC LIMIT 200`,
    params,
  );

  // Return both `results` and `ads` so either page consumption pattern works
  return Response.json({ results: result.rows, ads: result.rows });
}

// POST /api/admin/market-research/ad-spy
// body: { platform: 'facebook' | 'google' | 'linkedin' }
// Simulates fetching from free ad libraries (real API requires app credentials)
export async function POST(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const body = (await req.json()) as { platform?: string };
  const platform = body.platform ?? 'facebook';

  const validPlatforms = ['facebook', 'google', 'linkedin'];
  if (!validPlatforms.includes(platform)) {
    return Response.json({ error: 'platform must be facebook, google, or linkedin' }, { status: 400 });
  }

  // Simulate pulling from free ad libraries
  // Meta Ad Library API: https://www.facebook.com/ads/library/api/ — requires Facebook App + token
  // Google Ads Transparency: no public JSON API; scraping required
  // LinkedIn Ad Library: requires LinkedIn partner API access
  //
  // For now return stored results + note explaining real setup requirements
  const result = await pool.query<AdSpyRow>(
    'SELECT * FROM ad_spy_result WHERE platform = $1 ORDER BY fetched_at DESC LIMIT 50',
    [platform],
  );

  const libraryUrls: Record<string, string> = {
    facebook: 'https://www.facebook.com/ads/library',
    google: 'https://adstransparency.google.com',
    linkedin: 'https://www.linkedin.com/ad-library',
  };

  return Response.json({
    ads: result.rows,
    results: result.rows,
    note: `Returning stored results for ${platform}. To enable live fetching: ${platform === 'facebook' ? 'create a Facebook App, request Ads Library API access, and set FACEBOOK_APP_ID + FACEBOOK_APP_SECRET env vars' : platform === 'google' ? 'Google Ads Transparency has no public JSON API — requires web scraping or Google Ads API access via GOOGLE_ADS_DEVELOPER_TOKEN' : 'LinkedIn Ad Library requires LinkedIn Marketing Developer Platform access — set LINKEDIN_CLIENT_ID + LINKEDIN_CLIENT_SECRET'}. Public library URL: ${libraryUrls[platform]}`,
    realApiRequired: true,
  });
}

interface OllamaResponse {
  response?: string;
}

// PATCH /api/admin/market-research/ad-spy
// body: { id: number } — triggers Ollama AI analysis for a specific ad
export async function PATCH(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const body = (await req.json()) as { id?: number };
  if (typeof body.id !== 'number') {
    return Response.json({ error: 'id (number) required' }, { status: 400 });
  }

  const adRes = await pool.query<AdSpyRow>(
    'SELECT * FROM ad_spy_result WHERE id = $1',
    [body.id],
  );
  if (adRes.rowCount === 0) {
    return Response.json({ error: 'Ad not found' }, { status: 404 });
  }

  const ad = adRes.rows[0];
  const text = [ad.headline, ad.ad_text].filter(Boolean).join(' — ');

  let analysis = '';
  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2',
        prompt: `Analyze this competitor ad in 2-3 concise sentences. Identify: messaging angle, call-to-action tactic, and likely target audience.
Ad: "${text.slice(0, 500)}"`,
        stream: false,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    const data = (await res.json()) as OllamaResponse;
    analysis = data.response ?? '';
  } catch {
    analysis = 'Ollama unavailable for analysis.';
  }

  // Store analysis in raw_data since ad_spy_result has no ai_analysis column
  await pool.query(
    `UPDATE ad_spy_result SET raw_data = raw_data || $1 WHERE id = $2`,
    [JSON.stringify({ ai_analysis: analysis }), body.id],
  );

  return Response.json({ ok: true, analysis });
}
