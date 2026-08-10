// SeoReportJob — Weekly Friday 07:00 UTC
// AI-generates a weekly SEO health report from Matomo analytics.
// Stored as draft — requires staff review before sharing.

import { Pool } from 'pg';
import { ollama } from '../OllamaClient';

const db     = new Pool({ connectionString: process.env.DATABASE_URL });
const MATOMO = process.env.MATOMO_BASE_URL  ?? 'http://localhost:8080';
const SITE   = process.env.MATOMO_SITE_ID   ?? '1';
const TOKEN  = process.env.MATOMO_AUTH_TOKEN ?? '';

const SYSTEM = `You are an SEO analyst. Given web analytics data for a yoga studio website,
write a concise weekly SEO health report with:
1. Top performing pages
2. Traffic sources
3. One improvement suggestion
Keep it under 300 words. Plain text.`;

async function matomoGet(method: string, period = 'week', date = 'last1') {
  try {
    const url = `${MATOMO}/index.php?module=API&method=${method}&idSite=${SITE}&period=${period}&date=${date}&format=JSON&token_auth=${TOKEN}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export async function run(): Promise<void> {
  const weekOf = new Date().toISOString().split('T')[0];

  const [pages, sources, overview] = await Promise.all([
    matomoGet('Actions.getPageUrls', 'week', 'last1'),
    matomoGet('Referrers.getAll',    'week', 'last1'),
    matomoGet('VisitsSummary.get',   'week', 'last1'),
  ]);

  const context = [
    overview ? `Visits: ${overview.nb_visits ?? 0}, Unique: ${overview.nb_uniq_visitors ?? 0}, Bounce: ${overview.bounce_rate ?? 'n/a'}` : 'No overview data.',
    pages    ? `Top pages: ${(pages.slice?.(0,5) ?? []).map((p: { label: string; nb_visits: number }) => `${p.label} (${p.nb_visits} visits)`).join(', ')}` : 'No page data.',
    sources  ? `Traffic sources: ${(sources.slice?.(0,3) ?? []).map((s: { label: string; nb_visits: number }) => `${s.label} (${s.nb_visits})`).join(', ')}` : 'No referrer data.',
  ].join('\n');

  const report = await ollama.generate(context, {
    tier: 'fast', system: SYSTEM, maxTokens: 500, timeoutMs: 45_000,
  });

  // Store report in local DB as a draft document
  await db.query(`
    INSERT INTO seo_report (tenant_id, report_date, report_text, status)
    SELECT tenant_id, $1, $2, 'draft'
    FROM tenant LIMIT 1
    ON CONFLICT (report_date) DO UPDATE SET report_text=$2, status='draft', updated_at=NOW()
  `, [weekOf, report]);

  console.log(`[seo-report] week=${weekOf} report saved`);
  await db.end();
}
