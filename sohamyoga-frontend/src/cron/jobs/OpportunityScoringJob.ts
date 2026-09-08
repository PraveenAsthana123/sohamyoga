// OpportunityScoringJob — Daily 03:15 UTC
// Advisory-only AI scoring for open CRM opportunities, mirroring the
// ai_priority pattern already established for use_case_registry
// (BacklogPrioritizationJob). Writes ai_score/ai_note only -- never touches
// stage, probability_pct, or any field a human owns. An opportunity with no
// meaningful signal (just created, no notes) still gets scored honestly
// rather than skipped, since the prompt itself states what's known.

import { Pool } from 'pg';
import { ollama } from '../OllamaClient';
import { extractJson } from '../moduleRegistry';

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const CONCURRENCY = 5;

const SYSTEM = `You are a pragmatic sales-operations analyst reviewing one open CRM opportunity for a
small yoga-studio + digital-marketing business. You are given its stage, estimated value, currency,
days since creation, days since last update, and any notes. Decide:
  score: integer 0-100 -- relative priority for the sales team to focus on THIS WEEK (not a
    probability of closing; think "urgency x value x momentum")
  note: one short sentence, concrete, on why (e.g. "stalled 18 days in negotiation on a high-value
    deal -- follow up now" or "fresh qualification, no action needed yet")
Return exactly one JSON object with keys score, note. No markdown, no prose outside the JSON object.`;

interface OppRow {
  id: string; title: string; stage: string; estimated_value: string; currency: string;
  probability_pct: number | null; notes: string | null; created_at: string; updated_at: string;
}
interface Assessment { score: number; note: string }

function buildPrompt(o: OppRow): string {
  const daysOld = Math.round((Date.now() - new Date(o.created_at).getTime()) / 86_400_000);
  const daysStale = Math.round((Date.now() - new Date(o.updated_at).getTime()) / 86_400_000);
  return `Title: ${o.title}
Stage: ${o.stage}
Estimated value: ${o.estimated_value} ${o.currency}
Probability set by sales rep: ${o.probability_pct ?? 'not set'}%
Days since created: ${daysOld}
Days since last update: ${daysStale}
Notes: ${o.notes || '(none)'}`;
}

async function scoreOpportunity(o: OppRow): Promise<void> {
  const prompt = buildPrompt(o);
  let raw: string;
  try {
    raw = await ollama.generate(prompt, { tier: 'fast', system: SYSTEM, maxTokens: 150, timeoutMs: 60_000 });
  } catch (error) {
    console.error(`[opportunity-scoring] opportunity=${o.id} Ollama call failed:`, error);
    return;
  }

  let assessment: Assessment;
  try {
    assessment = extractJson<Assessment>(raw);
  } catch (error) {
    console.error(`[opportunity-scoring] opportunity=${o.id} parse failed:`, error);
    return;
  }

  const score = Math.max(0, Math.min(100, Math.round(Number(assessment.score) || 0)));
  const note = (assessment.note || '').slice(0, 300);

  await db.query(
    `UPDATE opportunity SET ai_score = $1, ai_note = $2, ai_assessed_at = now() WHERE id = $3`,
    [score, note, o.id],
  );
  console.log(`[opportunity-scoring] opportunity=${o.id} score=${score}`);
}

export async function run(): Promise<void> {
  const result = await db.query<OppRow>(
    `SELECT id, title, stage, estimated_value, currency, probability_pct, notes, created_at, updated_at
     FROM opportunity WHERE stage NOT IN ('closed_won','closed_lost')`,
  );

  console.log(`[opportunity-scoring] scoring ${result.rows.length} open opportunities, concurrency=${CONCURRENCY}`);
  for (let i = 0; i < result.rows.length; i += CONCURRENCY) {
    const batch = result.rows.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(scoreOpportunity));
  }
  console.log(`[opportunity-scoring] done — ${result.rows.length} opportunities assessed`);
  // Do NOT db.end() here — see NotificationRetryJob.ts.
}
