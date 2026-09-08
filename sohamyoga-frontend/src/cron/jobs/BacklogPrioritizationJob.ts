// BacklogPrioritizationJob — Nightly 02:30 UTC
// The 1,205-row use_case_registry has 111 distinct not_built/partial domains.
// Assessing each of the ~1,175 individual sub-features separately would be
// ~1,175 Ollama calls for no extra signal (sub-features in one domain share
// the same buildability story), so this assesses at the DOMAIN level: one
// Ollama call per domain, gathering its own use-case rows plus any linked
// module_registry entry as context. Runs domains through Ollama with bounded
// concurrency (5 at a time) rather than one-at-a-time, per explicit request.
// Purely advisory — it writes ai_priority/ai_buildability/ai_recommendation,
// it never changes `status`, never marks anything built, never deletes a row.

import { Pool } from 'pg';
import { ollama } from '../OllamaClient';
import { extractJson } from '../moduleRegistry';

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const CONCURRENCY = 5;

const SYSTEM = `You are a pragmatic engineering lead triaging a product backlog for a small,
single-developer team building a real (not fabricated) yoga-studio + digital-marketing SaaS.
You are given one "domain" (a named feature area) and the list of specific sub-features tracked
under it that are not yet built or only partially built, plus notes on any related module that
already exists in the codebase. Decide:
  priority: "high" | "medium" | "low" — value to a real customer vs. effort, given what already exists
  buildability: "buildable_now" | "needs_new_infra" | "blocked_external" —
    buildable_now = can be built today with the existing stack (Postgres/Next.js/Ollama, no new
      accounts, keys, or paid services needed)
    needs_new_infra = needs a new internal system/schema/pipeline this app doesn't have yet, but
      no external dependency
    blocked_external = needs a third-party account, paid API, or credential the team does not have
  recommendation: one sentence, concrete, on what to build first or why to defer
Return exactly one JSON object with keys priority, buildability, recommendation. No markdown, no
prose outside the JSON object.`;

interface DomainRow {
  domain: string;
  category: string;
  use_case_key: string;
  title: string;
  description: string;
  status: string;
  evidence: string | null;
  module_registry_key: string | null;
}

interface Assessment {
  priority: string;
  buildability: string;
  recommendation: string;
}

const VALID_PRIORITY = new Set(['high', 'medium', 'low']);
const VALID_BUILDABILITY = new Set(['buildable_now', 'needs_new_infra', 'blocked_external']);

function buildPrompt(domain: string, rows: DomainRow[]): string {
  const category = rows[0].category;
  const features = rows
    .slice(0, 25)
    .map(r => `- [${r.status}] ${r.title}${r.description ? `: ${r.description}` : ''}`)
    .join('\n');
  const moreCount = rows.length > 25 ? `\n...and ${rows.length - 25} more sub-features in this domain.` : '';
  const moduleKeys = [...new Set(rows.map(r => r.module_registry_key).filter(Boolean))];
  const moduleNote = moduleKeys.length
    ? `Related existing module_registry key(s): ${moduleKeys.join(', ')}.`
    : `No related module_registry entry exists yet for this domain.`;

  return `Domain: ${domain}
Category: ${category}
${moduleNote}

Not-yet-built or partial sub-features tracked under this domain:
${features}${moreCount}`;
}

async function assessDomain(domain: string, rows: DomainRow[]): Promise<void> {
  const prompt = buildPrompt(domain, rows);
  let raw: string;
  try {
    raw = await ollama.generate(prompt, { tier: 'strong', system: SYSTEM, maxTokens: 300, timeoutMs: 90_000 });
  } catch (error) {
    console.error(`[backlog-prioritization] domain="${domain}" Ollama call failed:`, error);
    return;
  }

  let assessment: Assessment;
  try {
    assessment = extractJson<Assessment>(raw);
  } catch (error) {
    console.error(`[backlog-prioritization] domain="${domain}" parse failed:`, error);
    return;
  }

  const priority = VALID_PRIORITY.has(assessment.priority) ? assessment.priority : 'medium';
  const buildability = VALID_BUILDABILITY.has(assessment.buildability) ? assessment.buildability : 'needs_new_infra';
  const recommendation = (assessment.recommendation || '').slice(0, 500);

  await db.query(
    `UPDATE use_case_registry
     SET ai_priority = $1, ai_buildability = $2, ai_recommendation = $3, ai_assessed_at = now()
     WHERE domain = $4 AND status IN ('not_built','partial')`,
    [priority, buildability, recommendation, domain],
  );

  console.log(`[backlog-prioritization] domain="${domain}" priority=${priority} buildability=${buildability}`);
}

export async function run(): Promise<void> {
  const result = await db.query<DomainRow>(
    `SELECT domain, category, use_case_key, title, description, status, evidence, module_registry_key
     FROM use_case_registry
     WHERE status IN ('not_built','partial') AND ai_assessed_at IS NULL
     ORDER BY domain`,
  );

  const byDomain = new Map<string, DomainRow[]>();
  for (const row of result.rows) {
    const list = byDomain.get(row.domain) ?? [];
    list.push(row);
    byDomain.set(row.domain, list);
  }

  const domains = [...byDomain.entries()];
  console.log(`[backlog-prioritization] assessing ${domains.length} domains, concurrency=${CONCURRENCY}`);

  for (let i = 0; i < domains.length; i += CONCURRENCY) {
    const batch = domains.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(([domain, rows]) => assessDomain(domain, rows)));
  }

  console.log(`[backlog-prioritization] done — ${domains.length} domains assessed`);
  // Do NOT db.end() here — runner.ts caches this module across every
  // scheduled invocation in the long-lived cron container; ending the pool
  // breaks every run after the first.
}
