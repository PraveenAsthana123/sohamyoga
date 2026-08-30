// Real, explainable response-quality signal for Survey Management -- the gap
// audit found the existing 11-table survey engine had zero quality-detection
// layer. Core checks are deterministic (always available, no dependency).
// The semantic text check calls local Ollama (127.0.0.1:11434, same host)
// as a genuine best-effort enhancement -- if Ollama is unreachable, it's
// skipped, never fabricated, and never blocks submission.

export interface QualityInput {
  npsScore: number;
  reasonText?: string;
  recentSameIpCount: number; // submissions from this IP to this survey in the last 10 minutes
}

export interface QualityResult {
  flags: string[];
  score: number; // 0-100, 100 = no concerns
}

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';

function coreFlags(input: QualityInput): string[] {
  const flags: string[] = [];
  if (input.recentSameIpCount > 0) flags.push('duplicate_ip_recent');
  const isExtreme = input.npsScore <= 1 || input.npsScore >= 9;
  if (isExtreme && !input.reasonText?.trim()) flags.push('extreme_score_no_reason');
  if (input.reasonText && input.reasonText.trim().length < 3 && input.reasonText.trim().length > 0) {
    flags.push('reason_too_short');
  }
  return flags;
}

/** Best-effort local-LLM check for gibberish/spam in free text. Never throws,
 * never blocks submission -- returns null if Ollama is unreachable or slow. */
async function semanticTextFlag(reasonText: string): Promise<string | null> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'phi4-mini:latest',
        prompt: `Reply with exactly one word, YES or NO. Is this survey comment gibberish, spam, or unrelated random text? Comment: "${reasonText.slice(0, 500)}"`,
        stream: false,
      }),
      signal: AbortSignal.timeout(4_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { response?: string };
    const answer = (body.response ?? '').trim().toUpperCase();
    return answer.startsWith('YES') ? 'semantic_low_quality' : null;
  } catch {
    return null; // Ollama down/slow -- fail open, don't fabricate a result
  }
}

export async function detectQuality(input: QualityInput): Promise<QualityResult> {
  const flags = coreFlags(input);
  if (input.reasonText?.trim() && input.reasonText.trim().length >= 3) {
    const semantic = await semanticTextFlag(input.reasonText.trim());
    if (semantic) flags.push(semantic);
  }
  const score = Math.max(0, 100 - flags.length * 25);
  return { flags, score };
}
