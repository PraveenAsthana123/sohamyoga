// Real sentiment classifier — the piece that was missing entirely (the
// `sentiment` field on read_comments was a passthrough filter parameter with
// no classifier behind it anywhere in this codebase). Ollama fast-tier,
// single-shot classification.

import { ollama } from '@/cron/OllamaClient';

export interface SentimentResult {
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number; // 0-1
  reason: string;
}

const SYSTEM = `You classify the sentiment of a single piece of customer-facing text
(a comment, review, or message) for a yoga studio business.
Return ONLY valid JSON: {"sentiment": "positive"|"neutral"|"negative", "confidence": 0.0-1.0, "reason": "one short sentence"}`;

function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || text;
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Ollama returned no JSON object');
  return JSON.parse(fenced.slice(start, end + 1)) as T;
}

export async function classifySentiment(text: string): Promise<SentimentResult> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('text is required');

  const response = await ollama.generate(trimmed, { tier: 'fast', system: SYSTEM, maxTokens: 150, timeoutMs: 45_000 });
  const parsed = extractJson<{ sentiment?: string; confidence?: number; reason?: string }>(response);

  const sentiment = ['positive', 'neutral', 'negative'].includes(parsed.sentiment ?? '')
    ? (parsed.sentiment as SentimentResult['sentiment']) : 'neutral';
  const confidence = typeof parsed.confidence === 'number' && parsed.confidence >= 0 && parsed.confidence <= 1
    ? parsed.confidence : 0.5;

  return { sentiment, confidence, reason: parsed.reason ?? '' };
}
