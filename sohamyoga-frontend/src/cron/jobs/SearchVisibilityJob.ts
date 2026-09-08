// SearchVisibilityJob — Weekly Friday 07:15 UTC (15 min after seo-report)
// Closes the documented gap: "marketing_search_visibility_snapshot table
// exists but zero job writes to it." Real organic-search keyword evidence
// from the same Matomo instance SeoReportJob already reads -- no new
// credential or API needed. Deliberately does NOT fabricate a SERP
// `position` (that requires a paid rank-tracking API this environment
// doesn't have, same honest blocker already documented for backlink
// tracking) -- position/is_cited stay NULL, exactly matching the columns'
// nullable schema design, rather than guessing a number.

import { Pool } from 'pg';

const db     = new Pool({ connectionString: process.env.DATABASE_URL });
const MATOMO = process.env.MATOMO_BASE_URL  ?? 'http://localhost:8080';
const SITE   = process.env.MATOMO_SITE_ID   ?? '1';
const TOKEN  = process.env.MATOMO_AUTH_TOKEN ?? '';

interface MatomoKeywordRow { label: string; nb_visits: number }

async function matomoGet(method: string): Promise<unknown> {
  try {
    const url = `${MATOMO}/index.php?module=API&method=${method}&idSite=${SITE}&period=week&date=last1&format=JSON&token_auth=${TOKEN}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export async function run(): Promise<void> {
  const keywords = await matomoGet('Referrers.getKeywords') as MatomoKeywordRow[] | null;

  // Same honest-skip discipline as SeoReportJob -- zero real data means
  // zero rows written, never a fabricated snapshot.
  if (!Array.isArray(keywords) || keywords.length === 0) {
    console.log('[search-visibility] skipped — Matomo unreachable or no organic-search keyword data this period');
    return;
  }

  const tenant = await db.query<{ id: string }>(`SELECT id FROM tenant LIMIT 1`);
  if (!tenant.rowCount) return;
  const tenantId = tenant.rows[0].id;

  let written = 0;
  for (const row of keywords) {
    if (!row.label || typeof row.nb_visits !== 'number' || row.nb_visits <= 0) continue;
    await db.query(
      `INSERT INTO marketing_search_visibility_snapshot (tenant_id, visibility_type, query, engine, brand_mentioned)
       VALUES ($1, 'seo', $2, 'organic_search', false)`,
      [tenantId, row.label.slice(0, 500)],
    );
    written++;
  }

  console.log(`[search-visibility] wrote ${written} real organic-search keyword snapshot(s) from Matomo`);
  // Do NOT db.end() here -- runner.ts caches this module across every
  // scheduled invocation in the long-lived cron container.
}
