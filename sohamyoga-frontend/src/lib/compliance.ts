// Content compliance checker — a second Ollama pass over generated marketing
// copy, grounded to the brief's own offer/CTA text. Catches the exact things
// the generation prompt already asks the model not to do (invent prices,
// certifications, medical outcomes, guarantees) but never verified. Runs
// automatically at generation time; the review panel surfaces the flag
// alongside approve/reject so a human still makes the final call — this
// does not auto-block or auto-send anything.

import { ollama } from '@/cron/OllamaClient';

export interface ComplianceResult {
  status: 'pass' | 'flagged';
  notes: string;
}

const SYSTEM = `You are a marketing-compliance reviewer for a yoga/wellness studio.
You are given the business's own offer text and call-to-action, then a piece of
AI-generated marketing copy based on them. Flag the copy if it does ANY of:
- states a price, discount amount, or certification not present in the offer text
- makes a guarantee ("guaranteed results", "will cure", "100% effective")
- makes a medical or health-outcome claim (e.g. "cures back pain", "eliminates anxiety")
  rather than a general wellness benefit
- invents a testimonial, statistic, or credential not present in the offer text
Minor rephrasing of the real offer is fine and should pass.
Return ONLY valid JSON: {"status": "pass"|"flagged", "notes": "one short sentence, empty string if pass"}`;

function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || text;
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Ollama returned no JSON object');
  return JSON.parse(fenced.slice(start, end + 1)) as T;
}

export async function checkContentCompliance(
  generatedText: string,
  source: { offerText: string; callToAction: string },
): Promise<ComplianceResult> {
  const trimmed = generatedText.trim();
  if (!trimmed) return { status: 'pass', notes: '' };

  try {
    const response = await ollama.generate(
      `Business's real offer text: ${source.offerText}\nBusiness's real CTA: ${source.callToAction}\n\nGenerated copy to review:\n${trimmed.slice(0, 4000)}`,
      { tier: 'fast', system: SYSTEM, maxTokens: 200, timeoutMs: 45_000 },
    );
    const parsed = extractJson<{ status?: string; notes?: string }>(response);
    const status = parsed.status === 'flagged' ? 'flagged' : 'pass';
    return { status, notes: parsed.notes ?? '' };
  } catch (error) {
    // Classification failure shouldn't block generation — surface as
    // 'flagged' so a human looks at it rather than silently passing.
    const message = error instanceof Error ? error.message : 'Compliance check failed';
    return { status: 'flagged', notes: `Automated check failed: ${message.slice(0, 200)}` };
  }
}
