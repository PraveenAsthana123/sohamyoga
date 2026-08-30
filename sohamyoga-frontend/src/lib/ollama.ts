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
import { assertCircuitAllows, finishOperation, recordCircuit as persistCircuit, recordError, recordModelInvocation, startOperation } from './operation-ledger';
import { OllamaCircuitBreaker } from '@sohamyoga/shared-backend';

export const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:latest';

// keep_alive keeps the model resident in VRAM between calls so only the first
// request pays cold-start latency (mirrors agentic-ollama-platform §165).
export const OLLAMA_KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || '30m';

// Resilience budgets (ms) — a frozen local model must never freeze the UI.
// first-token: how long to wait for generation to begin (cold load allowance);
// idle: max gap between tokens once streaming; deadline: overall hard stop.
const num = (v: string | undefined, d: number) => (v && !Number.isNaN(+v) ? +v : d);
export const FIRST_TOKEN_TIMEOUT_MS = num(process.env.OLLAMA_FIRST_TOKEN_TIMEOUT_MS, 60000);
export const IDLE_TIMEOUT_MS = num(process.env.OLLAMA_IDLE_TIMEOUT_MS, 25000);
export const DEADLINE_MS = num(process.env.OLLAMA_DEADLINE_MS, 300000);

// Deduplicated 2026-08-24: this was a hand-rolled copy of the exact same
// state machine market-research-portal's OllamaClient.ts independently
// built — both now share packages/shared-backend's OllamaCircuitBreaker.
// Same threshold/cooldown as before this change; behavior unchanged.
const breaker = new OllamaCircuitBreaker(3, 30000);

export function circuitOpen(): boolean {
  return breaker.isOpen();
}
function recordSuccess() {
  breaker.recordSuccess();
}
function recordFailure() {
  breaker.recordFailure();
}

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
    if (!res.ok) throw new Error(`Ollama health check failed (${res.status})`);
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    return (data.models || []).map((m) => m.name);
  } finally {
    clearTimeout(t);
  }
}

export async function listOllamaModels(): Promise<string[]> {
  try { return await fetchOllamaModels(); } catch { return []; }
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
    return { ok, model: modelName, url: OLLAMA_URL, models,
      error: ok ? undefined : `Model ${modelName} is not installed.` };
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
  const selectedModel = opts.model || OLLAMA_MODEL;
  const run = await startOperation({ componentKey: 'soham-next', operationType: 'model_invocation', operationName: `Ollama chat: ${selectedModel}`, source: 'next-server', requestSummary: messages.at(-1)?.content.slice(0,500), input: { messageCount: messages.length, model: selectedModel } });
  const startedAt = Date.now();
  const promptChars = messages.reduce((n,m) => n+m.content.length,0);
  let outputChars = 0;
  if (circuitOpen()) {
    await finishOperation(run,'blocked');
    throw new Error('Local AI is temporarily unavailable (circuit open) — retry shortly.');
  }
  try {
    await assertCircuitAllows('soham-next','ollama-daemon');
  } catch (error) {
    await recordError(run,'soham-next',error,{ model:selectedModel, blockedByCircuit:true });
    await finishOperation(run,'blocked',{ reason:'circuit_open' });
    throw error;
  }

  const body = {
    model: selectedModel,
    messages,
    stream: true,
    keep_alive: OLLAMA_KEEP_ALIVE,
    options: {
      temperature: opts.temperature ?? 0.4,
      num_predict: opts.numPredict ?? 768,
    },
  };

  // Internal abort controller drives the watchdog timers; the caller's signal
  // (client disconnect) is chained in so either can cancel the upstream fetch.
  const ctrl = new AbortController();
  const abort = () => ctrl.abort();
  if (opts.signal) {
    if (opts.signal.aborted) ctrl.abort();
    else opts.signal.addEventListener('abort', abort, { once: true });
  }

  let sawFirstToken = false;
  let timedOutReason = '';
  const deadline = setTimeout(() => { timedOutReason = 'overall deadline'; ctrl.abort(); }, DEADLINE_MS);
  let gap = setTimeout(() => { timedOutReason = 'no first token'; ctrl.abort(); }, FIRST_TOKEN_TIMEOUT_MS);
  const bumpIdle = () => {
    clearTimeout(gap);
    gap = setTimeout(() => { timedOutReason = 'stream idle'; ctrl.abort(); }, IDLE_TIMEOUT_MS);
  };
  const cleanup = () => {
    clearTimeout(deadline);
    clearTimeout(gap);
    opts.signal?.removeEventListener('abort', abort);
  };

  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Ollama chat failed: ${res.status} ${detail}`.trim());
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      let readResult;
      try {
        readResult = await reader.read();
      } catch (e) {
        // Abort during read → surface the watchdog reason, not a raw AbortError.
        if (timedOutReason) throw new Error(`Local AI timed out (${timedOutReason}).`);
        throw e;
      }
      const { done, value } = readResult;
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
          if (delta) {
            outputChars += delta.length;
            if (!sawFirstToken) sawFirstToken = true;
            bumpIdle();
            yield delta;
          }
          if (chunk.done) {
            recordSuccess();
            await persistCircuit('soham-next','ollama-daemon',true);
            await recordModelInvocation(run,selectedModel,{ status:'succeeded',purpose:'chat',promptChars,outputChars,latencyMs:Date.now()-startedAt });
            await finishOperation(run,'succeeded',{ outputChars });
            return;
          }
        } catch (e) {
          // Ignore partial/garbled lines; rethrow explicit Ollama errors.
          if (e instanceof Error && e.message && !e.message.startsWith('Unexpected')) {
            throw e;
          }
        }
      }
    }
    recordSuccess();
    await persistCircuit('soham-next','ollama-daemon',true);
    await recordModelInvocation(run,selectedModel,{ status:'succeeded',purpose:'chat',promptChars,outputChars,latencyMs:Date.now()-startedAt });
    await finishOperation(run,'succeeded',{ outputChars });
  } catch (error) {
    if (!opts.signal?.aborted) recordFailure();
    await persistCircuit('soham-next','ollama-daemon',false);
    await recordError(run,'soham-next',error,{ model:selectedModel });
    const status = timedOutReason ? 'timeout' : 'failed';
    await recordModelInvocation(run,selectedModel,{ status,purpose:'chat',promptChars,outputChars,latencyMs:Date.now()-startedAt });
    await finishOperation(run,status,{ timedOutReason });
    throw error;
  } finally {
    cleanup();
  }
}
