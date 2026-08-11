// GitHubRepoScoutJob — Monthly (1st, 06:00 UTC) + on-demand via the Demo
// Hub. Answers the explicit request "assign job to ollama to search on
// github" for open-source reuse candidates relevant to the growth-loop
// build (referral/affiliate tracking, influencer platforms, viral/trend
// detection, social automation via n8n).
//
// Two real actions, both against the real public GitHub REST API (no
// invented star counts, descriptions, or push dates):
//   1. Enrich every candidate row missing real metadata (stars,
//      description, last_pushed_at) — including the user's own seeded
//      shortlist — via GET /repos/{full_name}.
//   2. Search a small fixed query list via GET /search/repositories and
//      upsert genuinely new candidates, source='ollama_search'.
// Ollama writes a 1-2 sentence relevance note ONLY for newly discovered
// candidates (the user's seeded rows already carry their own stated
// reason) — strictly from the real name/description/star count the GitHub
// API returned, never inventing a capability it can't see.
//
// This job never clones, installs, or runs anything it finds — it produces
// a reading list for a human to review, per the spec's "WAIT / No Action
// is important" guardrail.

import { Pool } from 'pg';
import { ollama } from '../OllamaClient';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const DISCOVERY_QUERIES = [
  'referral tracking self-hosted',
  'influencer marketing open source',
  'social media viral detection open source',
  'instagram automation n8n',
];

const GITHUB_API = 'https://api.github.com';
const MAX_ENRICH_PER_RUN = 20;
const MAX_RESULTS_PER_QUERY = 5;

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'sohamyoga-growth-engine-github-scout',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

function extractText(raw: string): string {
  return raw.trim().replace(/^```(?:text)?\s*/i, '').replace(/```\s*$/i, '').trim();
}

interface GhRepo { full_name: string; html_url: string; stargazers_count: number; description: string | null; pushed_at: string }

export async function run(): Promise<void> {
  const tenant = await db.query<{ id: string }>(`SELECT id FROM tenant LIMIT 1`);
  if (!tenant.rowCount) { console.log('[github-repo-scout] no tenant configured, skipping'); return; }
  const tenantId = tenant.rows[0].id;

  // 1. Enrich rows missing real metadata (bounded per run to respect the
  // unauthenticated GitHub rate limit of 60 requests/hour).
  const toEnrich = await db.query<{ id: string; full_name: string }>(
    `SELECT id, full_name FROM github_scout_candidate WHERE tenant_id = $1 AND enriched_at IS NULL LIMIT $2`,
    [tenantId, MAX_ENRICH_PER_RUN],
  );
  let enriched = 0;
  for (const row of toEnrich.rows) {
    try {
      const res = await fetch(`${GITHUB_API}/repos/${row.full_name}`, { headers: githubHeaders() });
      if (!res.ok) { console.warn(`[github-repo-scout] enrich failed for ${row.full_name}: ${res.status}`); continue; }
      const repo = (await res.json()) as GhRepo;
      await db.query(
        `UPDATE github_scout_candidate SET stars = $1, description = $2, last_pushed_at = $3, enriched_at = now() WHERE id = $4`,
        [repo.stargazers_count, repo.description, repo.pushed_at, row.id],
      );
      enriched++;
    } catch (err) {
      console.error(`[github-repo-scout] enrich error for ${row.full_name}:`, err);
    }
  }

  // 2. Discover new candidates via a small fixed query list.
  const newlyDiscovered: { id: string; fullName: string; description: string | null; stars: number }[] = [];
  for (const q of DISCOVERY_QUERIES) {
    try {
      const url = `${GITHUB_API}/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${MAX_RESULTS_PER_QUERY}`;
      const res = await fetch(url, { headers: githubHeaders() });
      if (!res.ok) { console.warn(`[github-repo-scout] search failed for "${q}": ${res.status}`); continue; }
      const body = (await res.json()) as { items: GhRepo[] };
      for (const repo of body.items ?? []) {
        const existing = await db.query<{ id: string }>(
          `SELECT id FROM github_scout_candidate WHERE tenant_id = $1 AND full_name = $2`,
          [tenantId, repo.full_name],
        );
        if (existing.rowCount) continue;
        const inserted = await db.query<{ id: string }>(
          `INSERT INTO github_scout_candidate (tenant_id, full_name, url, stars, description, last_pushed_at, matched_query, source, enriched_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'ollama_search',now())
           RETURNING id`,
          [tenantId, repo.full_name, repo.html_url, repo.stargazers_count, repo.description, repo.pushed_at, q],
        );
        newlyDiscovered.push({ id: inserted.rows[0].id, fullName: repo.full_name, description: repo.description, stars: repo.stargazers_count });
      }
    } catch (err) {
      console.error(`[github-repo-scout] search error for "${q}":`, err);
    }
  }

  console.log(`[github-repo-scout] enriched ${enriched} row(s), discovered ${newlyDiscovered.length} new candidate(s)`);

  for (const candidate of newlyDiscovered) {
    try {
      const prompt = `Repository: ${candidate.fullName}. Stars: ${candidate.stars}. Description: ${candidate.description ?? '(none provided)'}.`;
      const raw = await ollama.generate(prompt, {
        tier: 'fast',
        system: 'You are a technical scout evaluating open-source repositories for a yoga-studio growth engine (referral tracking, influencer marketing, viral detection, social automation). Given one real repo name, star count, and description, write 1-2 sentences on its relevance. Only reason from the name/stars/description given — do not invent features, license terms, or maturity claims not stated there.',
        maxTokens: 150, timeoutMs: 45_000,
      });
      const note = extractText(raw);
      await db.query(`UPDATE github_scout_candidate SET relevance_note = $1 WHERE id = $2`, [note, candidate.id]);
    } catch (err) {
      console.error(`[github-repo-scout] relevance note failed for ${candidate.fullName}:`, err);
    }
  }
  // Do NOT db.end() here — runner.ts caches this module across every
  // scheduled invocation in the long-lived cron container.
}
