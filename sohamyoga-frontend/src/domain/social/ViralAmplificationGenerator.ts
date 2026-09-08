import { ollama } from '../../cron/OllamaClient';

// Viral Content Builder / Hook Generator / Amplification Screen -- when
// ViralDetectionJob flags a post as a real statistical outlier (is_viral),
// draft real cross-platform amplification hooks from the post's OWN actual
// content, saved as social_content_draft rows for human review. Advisory
// only, same guardrail as ViralDetectionJob itself: this never auto-posts
// or boosts anything -- it only drafts text a human can choose to publish.
export interface AmplificationHook {
  hook: string;
}

const SYSTEM = `You are a social media strategist. A post has gone unusually viral for this account
(real, statistically-measured engagement spike, not a guess). Given the post's own real text, write
3 short alternative "hook" openers (1-2 sentences each) a human could use to re-share or cross-post
this same content on another platform to capture the momentum. Do not invent statistics, numbers,
or claims not present in the original text. Return exactly 3 hooks, one per line, no numbering, no
markdown, no extra commentary.`;

// The model sometimes prepends a meta-commentary preamble despite being told
// not to (observed live: "Here are three alternative hook openers:") --
// filter those out rather than trust line position alone.
function isPreamble(line: string): boolean {
  return /^(here are|below are|these are|sure|certainly|alternative)/i.test(line) || line.endsWith(':');
}

export async function generateAmplificationHooks(originalText: string): Promise<AmplificationHook[]> {
  const raw = await ollama.generate(`Original post:\n${originalText}`, {
    tier: 'strong', system: SYSTEM, maxTokens: 400, timeoutMs: 60_000,
  });
  const lines = raw.split('\n')
    .map(l => l.replace(/^[-*\d.)\s]+/, '').trim())
    .filter(Boolean)
    .filter(l => !isPreamble(l));
  if (lines.length < 1) throw new Error('Ollama returned no usable hooks.');
  return lines.slice(0, 3).map(hook => ({ hook }));
}
