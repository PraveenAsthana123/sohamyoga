// FunnelStageAnalysisJob — Weekly Thursday 08:00 UTC
// Computes real per-stage unique-visitor counts and real stage-to-stage
// conversion rates from tracking_event/campaign_lead/booking/survey data
// for the past 7 days, then stores them. Ollama is used only to diagnose
// the weakest transition each week — it explains a real, already-computed
// leak (which stage, what conversion rate), it never invents the numbers
// themselves. Stages are scoped to what this platform actually tracks —
// there is no ad-impression/reach data (no ad platform connected), so the
// funnel begins at real on-site engagement, not ad awareness.

import { Pool } from 'pg';
import { ollama } from '../OllamaClient';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const STAGES = ['engagement', 'interest', 'intent', 'lead', 'conversion', 'experience', 'advocacy'] as const;
type Stage = typeof STAGES[number];

const LEAK_THRESHOLD_PCT = 20; // below this, a transition is flagged as a leak worth diagnosing

function extractText(raw: string): string {
  return raw.trim().replace(/^```(?:text)?\s*/i, '').replace(/```\s*$/i, '').trim();
}

async function countStage(stage: Stage, periodStart: string, periodEnd: string): Promise<number> {
  switch (stage) {
    case 'engagement': {
      const r = await db.query<{ n: string }>(
        `SELECT COUNT(DISTINCT anonymous_id)::text AS n FROM tracking_event
         WHERE event_type IN ('page_view','click') AND created_at >= $1 AND created_at < $2`,
        [periodStart, periodEnd],
      );
      return Number(r.rows[0].n);
    }
    case 'interest': {
      const r = await db.query<{ n: string }>(
        `SELECT COUNT(DISTINCT anonymous_id)::text AS n FROM tracking_event
         WHERE event_type = 'click' AND (name LIKE '%cta_click%' OR name LIKE '%book_now%')
           AND created_at >= $1 AND created_at < $2`,
        [periodStart, periodEnd],
      );
      return Number(r.rows[0].n);
    }
    case 'intent': {
      const r = await db.query<{ n: string }>(
        `SELECT COUNT(DISTINCT anonymous_id)::text AS n FROM tracking_event
         WHERE event_type IN ('form_start','booking_started') AND created_at >= $1 AND created_at < $2`,
        [periodStart, periodEnd],
      );
      return Number(r.rows[0].n);
    }
    case 'lead': {
      const r = await db.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM campaign_lead WHERE created_at >= $1 AND created_at < $2`,
        [periodStart, periodEnd],
      );
      return Number(r.rows[0].n);
    }
    case 'conversion': {
      const r = await db.query<{ n: string }>(
        `SELECT (
           (SELECT COUNT(DISTINCT anonymous_id) FROM tracking_event
             WHERE event_type IN ('booking_completed','payment_completed') AND created_at >= $1 AND created_at < $2)
           +
           (SELECT COUNT(*) FROM booking WHERE status IN ('confirmed','checked_in') AND booked_at >= $1 AND booked_at < $2)
         )::text AS n`,
        [periodStart, periodEnd],
      );
      return Number(r.rows[0].n);
    }
    case 'experience': {
      const r = await db.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM survey_response WHERE submitted_at >= $1 AND submitted_at < $2`,
        [periodStart, periodEnd],
      );
      return Number(r.rows[0].n);
    }
    case 'advocacy': {
      const r = await db.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM survey_answer a
         JOIN survey_question q ON q.id = a.question_id AND q.type = 'nps'
         JOIN survey_response sr ON sr.id = a.response_id
         WHERE a.value_number >= 9 AND sr.submitted_at >= $1 AND sr.submitted_at < $2`,
        [periodStart, periodEnd],
      );
      return Number(r.rows[0].n);
    }
  }
}

export async function run(): Promise<void> {
  const tenant = await db.query<{ id: string }>(`SELECT id FROM tenant LIMIT 1`);
  if (!tenant.rowCount) { console.log('[funnel-stage-analysis] no tenant configured, skipping'); return; }
  const tenantId = tenant.rows[0].id;

  const periodEnd = new Date();
  const periodStart = new Date(periodEnd);
  periodStart.setDate(periodStart.getDate() - 7);
  const periodStartStr = periodStart.toISOString().slice(0, 10);
  const periodEndStr = periodEnd.toISOString().slice(0, 10);

  const counts: Record<Stage, number> = {} as Record<Stage, number>;
  for (let i = 0; i < STAGES.length; i++) {
    const stage = STAGES[i];
    const count = await countStage(stage, periodStart.toISOString(), periodEnd.toISOString());
    counts[stage] = count;
    await db.query(
      `INSERT INTO funnel_stage_snapshot (tenant_id, period_start, period_end, stage, stage_order, unique_count)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (tenant_id, period_start, period_end, stage) DO UPDATE SET unique_count = $6`,
      [tenantId, periodStartStr, periodEndStr, stage, i + 1, count],
    );
  }

  // Weakest real transition this period, by conversion rate — only
  // considered where the "from" stage actually had traffic (avoids a
  // divide-by-zero reading as a 0% "leak" when there's simply no data yet).
  let weakest: { from: Stage; to: Stage; fromCount: number; toCount: number; rate: number } | null = null;
  for (let i = 0; i < STAGES.length - 1; i++) {
    const from = STAGES[i];
    const to = STAGES[i + 1];
    const fromCount = counts[from];
    const toCount = counts[to];
    const rate = fromCount > 0 ? Math.round((toCount / fromCount) * 10000) / 100 : 0;
    const isLeak = fromCount > 0 && rate < LEAK_THRESHOLD_PCT;

    await db.query(
      `INSERT INTO funnel_transition_finding (tenant_id, period_start, period_end, from_stage, to_stage, from_count, to_count, conversion_rate, is_leak)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (tenant_id, period_start, period_end, from_stage, to_stage)
       DO UPDATE SET from_count=$6, to_count=$7, conversion_rate=$8, is_leak=$9`,
      [tenantId, periodStartStr, periodEndStr, from, to, fromCount, toCount, rate, isLeak],
    );

    if (fromCount > 0 && (!weakest || rate < weakest.rate)) {
      weakest = { from, to, fromCount, toCount, rate };
    }
  }

  if (weakest && weakest.rate < LEAK_THRESHOLD_PCT) {
    try {
      const prompt = `Funnel transition: ${weakest.from} (${weakest.fromCount} people) → ${weakest.to} (${weakest.toCount} people). Conversion rate: ${weakest.rate}%.`;
      const raw = await ollama.generate(prompt, {
        tier: 'fast',
        system: 'You are a conversion-funnel analyst for a yoga studio. Given one real stage-to-stage conversion rate, write 1-2 sentences diagnosing the most likely cause and one concrete next step. Only reason from the numbers given — do not invent causes not implied by the data (e.g. do not claim a specific UX bug exists unless the numbers alone would suggest it).',
        maxTokens: 200, timeoutMs: 45_000,
      });
      const diagnosis = extractText(raw);
      await db.query(
        `UPDATE funnel_transition_finding SET ai_diagnosis = $1
         WHERE tenant_id=$2 AND period_start=$3 AND period_end=$4 AND from_stage=$5 AND to_stage=$6`,
        [diagnosis, tenantId, periodStartStr, periodEndStr, weakest.from, weakest.to],
      );
    } catch (err) {
      console.error('[funnel-stage-analysis] diagnosis failed:', err);
    }
  }

  console.log(`[funnel-stage-analysis] period=${periodStartStr}..${periodEndStr} stages=${JSON.stringify(counts)}`);
  // Do NOT db.end() here — runner.ts caches this module across every
  // scheduled invocation in the long-lived cron container; ending the pool
  // breaks every run after the first.
}
