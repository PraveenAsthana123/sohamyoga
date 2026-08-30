// Shared Ollama script-generation logic used by both VideoScriptDraftJob
// (batch, daily) and the on-demand /api/videos/[id]/generate-script route.
// Pure: takes video metadata, returns a parsed script or null. Callers own
// their own persistence (cron jobs and API routes use different pg clients).
import { ollama } from '@/cron/OllamaClient';

const SYSTEM = `You are a yoga studio short-video scriptwriter.
Given a video title, description, and tags, write a real, concrete spoken-word script
(60-90 seconds when read aloud, plain text, no stage directions) plus 3-5 short hook-line
variants (each under 12 words).
Return ONLY a valid JSON object: {"script": string, "hooks": string[]}. No markdown fences, no explanation.`;

export interface VideoScriptInput {
  title: string;
  description: string;
  tags: string[];
}

export interface VideoScriptResult {
  script: string;
  hooks: string[];
}

function parseScriptResponse(raw: string): VideoScriptResult | null {
  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenced) text = fenced[1].trim();
  try {
    const parsed = JSON.parse(text);
    if (
      typeof parsed.script === 'string' && parsed.script.trim() &&
      Array.isArray(parsed.hooks) && parsed.hooks.length >= 3 && parsed.hooks.length <= 5 &&
      parsed.hooks.every((h: unknown) => typeof h === 'string' && h.trim())
    ) {
      return { script: parsed.script, hooks: parsed.hooks };
    }
    return null;
  } catch {
    return null;
  }
}

export async function generateVideoScript(input: VideoScriptInput): Promise<VideoScriptResult | null> {
  const prompt = [
    `Title: ${input.title}`,
    `Description: ${input.description}`,
    `Tags: ${(input.tags ?? []).join(', ')}`,
  ].join('\n');

  const raw = await ollama.generate(prompt, { tier: 'strong', system: SYSTEM, maxTokens: 500, timeoutMs: 60_000 });
  return parseScriptResponse(raw);
}
