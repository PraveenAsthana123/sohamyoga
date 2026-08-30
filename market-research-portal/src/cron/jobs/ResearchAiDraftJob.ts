// ResearchAiDraftJob — generic, parameterized by (study_id, phase_id).
// Runs once per phase per study, triggered by "Run Pipeline" on the master
// page (not on a fixed cron schedule — job_registry.schedule for this job
// says "on-demand").
//
// Action/Test/Advise shape (same idiom as sohamyoga-frontend's
// ReferralInvitationJob.ts / MarketResearchPricingDigestJob.ts):
//   ACTION: deterministic, non-Ollama read of the phase's real reference
//     content (process_reference/input_reference/output_reference, ported
//     verbatim from docs/market-research-growth-framework.md §2) plus the
//     study's real topic_name — nothing here is invented.
//   TEST: a deterministic passesFactCheck() step — any dollar or percent
//     figure in Ollama's draft must appear verbatim in the grounding text
//     (reference content) or be explicitly marked as an estimate
//     ("estimate"/"estimated"/"approximately"/"~" nearby) — otherwise the
//     whole draft is discarded and phase_run.output_content falls back to
//     a safe, fact-free template built only from the real reference text.
//   ADVISE: the fact-checked draft (or safe fallback) is written to
//     phase_run.output_content — advisory only, a human reviews it via the
//     phase's Report tab.
//
// Every invocation writes a real phase_run_ai_log row (purpose=research_ai)
// with the real model name and real prompt/output character counts — never
// fabricated metadata.

import { ollama } from '../OllamaClient';
import { query } from '../../lib/postgres';
import { appendTransaction, setPhaseRunStatus } from '../../domain/pipeline/PipelineService';

export interface ResearchAiDraftParams {
  studyId: string;
  phaseId: string;
  phaseRunId: string;
}

export interface ResearchAiDraftResult {
  status: 'succeeded' | 'failed' | 'fact_check_rejected';
  factCheckPassed: boolean | null;
  modelName: string | null;
  promptChars: number;
  outputChars: number;
}

function extractText(raw: string): string {
  return raw.trim().replace(/^```(?:text)?\s*/i, '').replace(/```\s*$/i, '').trim();
}

/**
 * Reject any $ or % figure in the draft that doesn't appear verbatim in the
 * grounding text, unless it's within ~40 chars of an estimate marker. Never
 * let Ollama invent a number that isn't traceable to the real reference
 * content or explicitly flagged as an estimate.
 */
function passesFactCheck(draft: string, groundingText: string): boolean {
  const figures = [...draft.matchAll(/[$€£]\s?\d+(\.\d+)?|\d+(\.\d+)?\s?%/g)];
  if (!figures.length) return true;
  const estimateMarker = /estimat|approximat|~|roughly/i;
  return figures.every(match => {
    const figure = match[0];
    const idx = match.index ?? 0;
    if (groundingText.includes(figure)) return true;
    const windowStart = Math.max(0, idx - 40);
    const windowEnd = Math.min(draft.length, idx + figure.length + 40);
    return estimateMarker.test(draft.slice(windowStart, windowEnd));
  });
}

export async function run(params: ResearchAiDraftParams): Promise<ResearchAiDraftResult> {
  const { studyId, phaseId, phaseRunId } = params;

  // ACTION — deterministic read of the real phase reference + study topic.
  const phaseRow = await query<{ name: string; process_reference: string; input_reference: string; output_reference: string }>(
    `SELECT name, process_reference, input_reference, output_reference FROM phase WHERE id = $1`,
    [phaseId],
  );
  const studyRow = await query<{ topic_name: string }>(`SELECT topic_name FROM study WHERE id = $1`, [studyId]);
  if (!phaseRow.rowCount || !studyRow.rowCount) {
    throw new Error(`ResearchAiDraftJob: phase ${phaseId} or study ${studyId} not found`);
  }
  const phase = phaseRow.rows[0];
  const topicName = studyRow.rows[0].topic_name;
  const groundingText = `${phase.process_reference}\n${phase.input_reference}\n${phase.output_reference}`;

  await setPhaseRunStatus(phaseRunId, 'running');

  const prompt = `You are a market-research analyst. The topic under study is: "${topicName}".\n\nThis is the "${phase.name}" layer of a 17-layer market research framework. Its documented reference definition is:\n- What to investigate: ${phase.process_reference}\n- Data/KPI to use: ${phase.input_reference}\n- Forecast/decision this layer produces: ${phase.output_reference}\n\nWrite a short (3-5 sentence) research draft for the "${phase.name}" layer as it applies to "${topicName}". Ground every claim in the reference definition above. If you state a number, either it must come from the reference text verbatim, or you must clearly mark it as an estimate (e.g. "an estimated..."). Do not invent a precise statistic that isn't given to you.`;

  let outputContent: string;
  let factCheckPassed: boolean | null = null;
  let status: ResearchAiDraftResult['status'] = 'succeeded';
  let modelName: string | null = null;
  let outputChars = 0;

  try {
    const { text, model } = await ollama.generate(prompt, {
      tier: 'fast',
      system: 'You are a careful market-research analyst. Only state numeric figures that are explicitly given to you or clearly marked as an estimate — never invent a precise statistic.',
      maxTokens: 320,
      timeoutMs: 60_000,
    });
    modelName = model;
    const draft = extractText(text);
    outputChars = draft.length;
    factCheckPassed = passesFactCheck(draft, groundingText);
    if (factCheckPassed) {
      outputContent = draft;
    } else {
      status = 'fact_check_rejected';
      outputContent = `Research-AI draft was rejected by the deterministic fact-check (it stated a $ or % figure not traceable to the phase's reference text or marked as an estimate). Falling back to the reference definition only:\n\nWhat to investigate: ${phase.process_reference}\nData/KPI: ${phase.input_reference}\nForecast/decision: ${phase.output_reference}`;
    }
  } catch (err) {
    status = 'failed';
    outputContent = `Research-AI draft failed (Ollama unreachable or errored) — showing the reference definition only:\n\nWhat to investigate: ${phase.process_reference}\nData/KPI: ${phase.input_reference}\nForecast/decision: ${phase.output_reference}`;
    console.error(`[research-ai-draft] Ollama call failed for phase_run ${phaseRunId}:`, err);
  }

  await query(`UPDATE phase_run SET output_content = $1, updated_at = now() WHERE id = $2`, [outputContent, phaseRunId]);
  await query(
    `INSERT INTO phase_run_ai_log (phase_run_id, purpose, model_name, prompt_chars, output_chars, status, fact_check_passed)
     VALUES ($1, 'research_ai', $2, $3, $4, $5, $6)`,
    [phaseRunId, modelName ?? 'unavailable', prompt.length, outputChars, status, factCheckPassed],
  );
  await appendTransaction(phaseRunId, 'research_ai_draft', `Research-AI draft ${status} (model=${modelName ?? 'n/a'}, fact_check_passed=${factCheckPassed})`);
  await setPhaseRunStatus(phaseRunId, status === 'failed' ? 'failed' : 'completed');

  return { status, factCheckPassed, modelName, promptChars: prompt.length, outputChars };
}
