import { ollama } from '../../cron/OllamaClient';

// Prompt-based dynamic ad creative -- generates headline/description
// variants tailored to business type and target age group from a single
// prompt, closing a gap named explicitly in a ChatGPT platform-blueprint
// conversation (2026-09-01): "ads management, banner, prompt base change
// ...business, agegroup, etc." No equivalent existed anywhere in the
// codebase before this.
export interface AdCreativeTargeting {
  businessType: string;   // e.g. 'yoga studio', 'dental clinic', 'retail boutique'
  ageGroup: string;       // e.g. '18-24', '25-40', '40-60', '60+'
  tone?: string;          // e.g. 'warm', 'urgent', 'premium'
}

export interface AdCreativeVariant {
  headline: string;
  description: string;
}

function buildPrompt(basePrompt: string, targeting: AdCreativeTargeting, count: number): string {
  return `You are an ad copywriter. Write ${count} distinct ad creative variants for this business.

Business type: ${targeting.businessType}
Target age group: ${targeting.ageGroup}
Tone: ${targeting.tone ?? 'warm and inviting'}
Campaign brief: ${basePrompt}

Rules:
- Each headline must be 30 characters or fewer.
- Each description must be 90 characters or fewer.
- Language and appeal must genuinely fit the target age group (e.g. don't use slang for 60+, don't be overly formal for 18-24).
- Return ONLY a JSON array, no explanation, no markdown fences. Format exactly:
[{"headline": "...", "description": "..."}, ...]`;
}

export async function generateAdCreativeVariants(
  basePrompt: string,
  targeting: AdCreativeTargeting,
  count = 3,
): Promise<AdCreativeVariant[]> {
  const raw = await ollama.generate(buildPrompt(basePrompt, targeting, count), {
    tier: 'strong',
    maxTokens: 800,
    timeoutMs: 45_000,
  });

  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Ollama did not return a parseable JSON array of ad variants.');

  const parsed = JSON.parse(jsonMatch[0]) as unknown;
  if (!Array.isArray(parsed)) throw new Error('Expected a JSON array of ad variants.');

  return parsed
    .filter((v): v is AdCreativeVariant => typeof v === 'object' && v !== null && 'headline' in v && 'description' in v)
    .map(v => ({ headline: String(v.headline).slice(0, 30), description: String(v.description).slice(0, 90) }));
}
