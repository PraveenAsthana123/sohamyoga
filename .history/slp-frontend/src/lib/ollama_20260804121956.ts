// Server-side Ollama client.
//
// Talks to a local Ollama daemon (default http://127.0.0.1:11434). Kept
// server-only so the model host is never exposed to the browser and the
// public site simply calls same-origin /api/ai/* routes.
//
// Env:
//   OLLAMA_URL   — base URL of the Ollama daemon.
//                  In docker use http://host.docker.internal:11434 so the
//                  frontend container reaches Ollama running on the host.
//   OLLAMA_MODEL — chat model tag (must be `ollama pull`-ed). Default qwen2.5.
//
// This module runs on the Node.js runtime only (uses AbortController + fetch
// streaming). Do not import it into client components.

export const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:latest';

// keep_alive keeps the model resident in VRAM between calls so only the first
// request pays cold-start latency (mirrors agentic-ollama-platform §165).
export const OLLAMA_KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || '30m';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaChatOptions {
  model?: string;
  temperature?: number;
  numPredict?: number;
  signal?: AbortSignal;
}

async function fetchOllamaModels(): Promise<string[]> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: controller.signal });
    if (!res.ok) {
      return [];
    }
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    return (data.models || []).map((m) => m.name);
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

export async function listOllamaModels(): Promise<string[]> {
  return fetchOllamaModels();
}

/** Ping the daemon and confirm the configured model is available. */
export async function ollamaHealth(modelName = OLLAMA_MODEL): Promise<{
  ok: boolean;
  model: string;
  url: string;
  models: string[];
  error?: string;
}> {
  try {
    const models = await fetchOllamaModels();
    const base = modelName.split(':')[0];
    const ok = models.some((m) => m === modelName || m.split(':')[0] === base);
    return { ok, model: modelName, url: OLLAMA_URL, models };
  } catch (e) {
    return {
      ok: false,
      model: modelName,
      url: OLLAMA_URL,
      models: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Stream a chat completion from Ollama. Yields incremental content tokens as
 * plain strings. Ollama's /api/chat emits newline-delimited JSON when
 * stream:true — each line carries a `message.content` delta.
 */
export async function* streamOllamaChat(
  messages: ChatMessage[],
  opts: OllamaChatOptions = {},
): AsyncGenerator<string, void, unknown> {
  const body = {
    model: opts.model || OLLAMA_MODEL,
    messages,
    stream: true,
    keep_alive: OLLAMA_KEEP_ALIVE,
    options: {
      temperature: opts.temperature ?? 0.4,
      num_predict: opts.numPredict ?? 768,
    },
  };

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Ollama chat failed: ${res.status} ${detail}`.trim());
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Ollama emits one JSON object per line.
    let nl: number;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      try {
        const chunk = JSON.parse(line) as {
          message?: { content?: string };
          done?: boolean;
          error?: string;
        };
        if (chunk.error) throw new Error(chunk.error);
        const delta = chunk.message?.content;
        if (delta) yield delta;
        if (chunk.done) return;
      } catch (e) {
        // Ignore partial/garbled lines; rethrow explicit Ollama errors.
        if (e instanceof Error && e.message && !e.message.startsWith('Unexpected')) {
          throw e;
        }
      }
    }
  }
}
