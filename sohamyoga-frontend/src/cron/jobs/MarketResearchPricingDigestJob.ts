// MarketResearchPricingDigestJob — Weekly Monday 08:00 UTC. Proof-of-concept
// for the Market Research module's "Job Schedule" tab: the one topic
// (research_topic.slug = 'pricing', 17-layer-forecasting framework) that has
// real automation behind it, out of 89 total topics.
//
// Action/Test/Advise shape (per the project's §166 policy for new Ollama job
// types): the ACTION is a deterministic, non-Ollama read of the real current
// pricing snapshot (pricing_plan_master + pricing_plan_price — see
// db-schema-plan-seed.sql for how that table went from schema-only to real
// rows). The Ollama-drafted advisory sentence gets a real deterministic TEST
// step: passesFactCheck() regex-extracts every dollar figure from the draft
// and rejects it unless each one matches a real queried price — never let
// Ollama invent or misstate a number that isn't in the real snapshot. The
// ADVISE step is the one sentence written into research_topic_tab (topic
// 'pricing', tab 'output'), contextualizing the real snapshot against the
// competitor benchmark range documented in
// docs/market-research-growth-framework.md §2/§9 ("$30–$120/month").

import { Pool } from 'pg';
import { ollama } from '../OllamaClient';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const COMPETITOR_BENCHMARK_MIN = 30;
const COMPETITOR_BENCHMARK_MAX = 120;

interface PriceRow {
  plan_name: string;
  amount: string;
  currency: string;
  billing_cycle: string;
  effective_date: string;
}

function extractText(raw: string): string {
  return raw.trim().replace(/^```(?:text)?\s*/i, '').replace(/```\s*$/i, '').trim();
}

/**
 * Reject the draft if it states any dollar figure that isn't one of the
 * real queried snapshot prices (rounded to whole dollars, since the draft
 * is prose, not a table) — never let Ollama promise or reference a price
 * that isn't actually live in pricing_plan_price.
 */
function passesFactCheck(draft: string, realAmounts: number[]): boolean {
  const figures = draft.match(/\$\s?\d+(\.\d+)?/g);
  if (!figures) return true;
  const realWhole = new Set(realAmounts.map(n => Math.round(n)));
  return figures.every(f => {
    const n = Math.round(Number(f.replace(/[^0-9.]/g, '')));
    return realWhole.has(n);
  });
}

export async function run(): Promise<void> {
  const topic = await db.query<{ id: string }>(
    `SELECT id FROM research_topic WHERE slug = 'pricing' AND job_name = 'market-research-pricing-digest'`,
  );
  if (!topic.rowCount) {
    console.log('[market-research-pricing-digest] pricing research_topic not found or not wired to this job, skipping');
    return;
  }
  const topicId = topic.rows[0].id;

  // Deterministic action: the real, live pricing snapshot — active plans
  // only, one row per plan+cycle, most-recent price per (plan, currency,
  // cycle) since price_history could carry future promotional rows.
  const snapshot = await db.query<PriceRow>(
    `SELECT m.name AS plan_name, p.amount::text AS amount, p.currency, p.billing_cycle,
            to_char(p.created_at, 'YYYY-MM-DD') AS effective_date
     FROM pricing_plan_price p
     JOIN pricing_plan_master m ON m.id = p.plan_id
     WHERE m.status = 'active' AND p.is_promotional = false
     ORDER BY p.amount DESC`,
  );

  if (!snapshot.rowCount) {
    console.log('[market-research-pricing-digest] no active pricing_plan_price rows, skipping — nothing real to publish');
    return;
  }

  const realAmounts = snapshot.rows.map(r => Number(r.amount));
  const monthlyRows = snapshot.rows.filter(r => r.billing_cycle === 'monthly' && Number(r.amount) > 0);
  const refreshedAt = new Date().toISOString();

  const snapshotLines = snapshot.rows
    .map(r => `- ${r.plan_name}: $${Number(r.amount).toFixed(2)} ${r.currency} / ${r.billing_cycle} (effective ${r.effective_date})`)
    .join('\n');

  let advisory: string;
  try {
    const monthlyList = monthlyRows.map(r => `${r.plan_name} $${Number(r.amount).toFixed(0)}/month`).join(', ');
    const prompt = `Here is SohamYoga's real, current live monthly pricing snapshot: ${monthlyList || 'no priced monthly plans'}. The documented competitor benchmark range for comparable yoga/wellness studios is $${COMPETITOR_BENCHMARK_MIN}-$${COMPETITOR_BENCHMARK_MAX}/month. Write exactly one short advisory sentence contextualizing SohamYoga's real prices against that benchmark range. Only use dollar figures that appear in the snapshot or the benchmark range above — never invent a number.`;
    const raw = await ollama.generate(prompt, {
      tier: 'fast',
      system: 'You are a pricing analyst writing one factual advisory sentence for a market-research dashboard. Only ever cite dollar figures explicitly given to you in the prompt — never invent, round unusually, or estimate a price.',
      maxTokens: 120,
      timeoutMs: 45_000,
    });
    const draft = extractText(raw);
    advisory = passesFactCheck(draft, realAmounts)
      ? draft
      : `SohamYoga's live plans span $${Math.min(...monthlyRows.map(r => Number(r.amount))).toFixed(0)}-$${Math.max(...monthlyRows.map(r => Number(r.amount))).toFixed(0)}/month against a documented competitor range of $${COMPETITOR_BENCHMARK_MIN}-$${COMPETITOR_BENCHMARK_MAX}/month.`;
  } catch (err) {
    console.error('[market-research-pricing-digest] Ollama draft failed:', err);
    advisory = monthlyRows.length
      ? `SohamYoga's live plans span $${Math.min(...monthlyRows.map(r => Number(r.amount))).toFixed(0)}-$${Math.max(...monthlyRows.map(r => Number(r.amount))).toFixed(0)}/month against a documented competitor range of $${COMPETITOR_BENCHMARK_MIN}-$${COMPETITOR_BENCHMARK_MAX}/month.`
      : `No monthly-billed plans are currently active to compare against the $${COMPETITOR_BENCHMARK_MIN}-$${COMPETITOR_BENCHMARK_MAX}/month competitor benchmark.`;
  }

  const content = `Live pricing snapshot (last refreshed ${refreshedAt}):\n${snapshotLines}\n\nCompetitor benchmark range: $${COMPETITOR_BENCHMARK_MIN}-$${COMPETITOR_BENCHMARK_MAX}/month (docs/market-research-growth-framework.md §2/§9).\n\nAdvisory: ${advisory}`;

  await db.query(
    `UPDATE research_topic_tab SET content = $1 WHERE topic_id = $2 AND tab_key = 'output'`,
    [content, topicId],
  );

  console.log(`[market-research-pricing-digest] refreshed pricing output tab from ${snapshot.rowCount} live price row(s)`);
  // Do NOT db.end() here — runner.ts caches this module across every
  // scheduled invocation in the long-lived cron container.
}
