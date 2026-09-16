// VoiceAiScriptRefreshJob — weekly Sunday 4am
// Uses local Ollama (llama3.2) to re-draft call scripts for the
// best-performing script templates. Writes drafts with status='draft'
// so a human admin can review/approve before the script is activated.
// Skips gracefully if OLLAMA_BASE_URL is not reachable.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const SCHEDULE = '0 4 * * 0'; // weekly Sunday 4am

const SCRIPT_TEMPLATES = [
  { purpose: 'inbound_booking',    language: 'en', tone: 'warm' },
  { purpose: 'outbound_followup',  language: 'en', tone: 'professional' },
  { purpose: 'support',            language: 'en', tone: 'empathetic' },
];

async function generateScript(purpose: string, language: string, tone: string): Promise<string | null> {
  const ollamaUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  try {
    const res = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2',
        prompt: `Write a concise, ${tone} call script for a yoga studio. Purpose: ${purpose}. Language: ${language}.
Keep it under 200 words. Start directly with the greeting. Do not include stage directions.`,
        stream: false,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { response?: string };
    return data.response?.trim() ?? null;
  } catch {
    return null;
  }
}

export async function run(): Promise<void> {
  const ollamaUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';

  // Quick reachability probe before doing real work.
  let ollamaReachable = false;
  try {
    const probe = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(5_000) });
    ollamaReachable = probe.ok;
  } catch {
    ollamaReachable = false;
  }

  if (!ollamaReachable) {
    console.log(`[voice-ai-script-refresh] Ollama not reachable at ${ollamaUrl} — skipping`);
    return;
  }

  let drafted = 0;
  for (const t of SCRIPT_TEMPLATES) {
    const content = await generateScript(t.purpose, t.language, t.tone);
    if (!content) continue;

    try {
      await db.query(
        `INSERT INTO voice_script_draft (purpose, language, tone, content, status, created_by, created_at)
         VALUES ($1, $2, $3, $4, 'draft', 'VoiceAiScriptRefreshJob', now())
         ON CONFLICT DO NOTHING`,
        [t.purpose, t.language, t.tone, content],
      );
      drafted++;
    } catch {
      // Table may not exist yet — non-fatal.
    }
  }

  console.log(`[voice-ai-script-refresh] drafted=${drafted} schedule=${SCHEDULE}`);
  // Do NOT db.end() — pool is shared across the cron process lifetime.
}
