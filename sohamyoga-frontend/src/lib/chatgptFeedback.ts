// Real 2-way communication with ChatGPT via the official OpenAI API (Chat
// Completions) — NOT browser automation of the chatgpt.com consumer site,
// which has no supported API and would violate its terms of service.
// API key is entered via /admin/config/credentials (portal "openai") and
// read back here from OpenBao, same convention src/lib/skyvern.ts uses.

import { vaultRead } from './openbao';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

export interface ChatGptFeedbackResult {
  ok: boolean;
  response?: string;
  error?: string;
}

async function getApiKey(): Promise<string | null> {
  // Env var takes priority (useful for CI/local dev); vault is the real path.
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  const secret = await vaultRead<{ api_key: string }>('vault://secret/data/sohamyoga-portal/portals/openai');
  return secret?.api_key ?? null;
}

export async function askChatGptForFeedback(query: string): Promise<ChatGptFeedbackResult> {
  if (!query.trim()) return { ok: false, error: 'query is required.' };

  const apiKey = await getApiKey();
  if (!apiKey) {
    return {
      ok: false,
      error: 'OpenAI API key is not configured. Save one at /admin/config/credentials under "OpenAI (ChatGPT API)" first.',
    };
  }

  try {
    const res = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [{ role: 'user', content: query }],
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: `OpenAI API error (HTTP ${res.status}): ${body?.error?.message ?? 'unknown error'}` };
    }

    const body = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = body.choices?.[0]?.message?.content;
    if (!text) return { ok: false, error: 'OpenAI returned no response content.' };

    return { ok: true, response: text };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
