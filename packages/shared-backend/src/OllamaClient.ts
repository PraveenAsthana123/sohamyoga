import { OllamaCircuitBreaker } from './OllamaCircuitBreaker';

export const OLLAMA_MODELS = {
  fast:   process.env.OLLAMA_MODEL_FAST   ?? 'phi3:mini',
  code:   process.env.OLLAMA_MODEL_CODE   ?? 'deepseek-coder:6.7b',
  strong: process.env.OLLAMA_MODEL_STRONG ?? 'llama3.2:latest',
} as const;

export type OllamaModelTier = keyof typeof OLLAMA_MODELS;

export interface GenerateOptions {
  model?:       string;
  tier?:        OllamaModelTier;
  system?:      string;
  temperature?: number;
  maxTokens?:   number;
  timeoutMs?:   number;
}

/**
 * Simple non-streaming Ollama client with a circuit breaker. This is the
 * shared core used by market-research-portal's cron jobs directly, and can
 * back sohamyoga-frontend's simpler (non-streaming) call sites too — its
 * more elaborate streaming+observability-telemetry chat path
 * (src/lib/ollama.ts) stays app-specific but can wrap this same
 * OllamaCircuitBreaker instead of hand-rolling its own.
 */
export class OllamaClient {
  private readonly base: string;
  private readonly breaker: OllamaCircuitBreaker;

  constructor(base = process.env.OLLAMA_BASE_URL ?? process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434', breaker = new OllamaCircuitBreaker()) {
    this.base = base;
    this.breaker = breaker;
  }

  circuitOpen(): boolean {
    return this.breaker.isOpen();
  }

  private resolveModel(opts: GenerateOptions): string {
    if (opts.model) return opts.model;
    return OLLAMA_MODELS[opts.tier ?? 'fast'];
  }

  async generate(prompt: string, opts: GenerateOptions = {}): Promise<{
    text: string;
    model: string;
    latencyMs: number;
    promptTokens: number | null;
    completionTokens: number | null;
  }> {
    if (this.breaker.isOpen()) {
      throw new Error('Local Ollama is temporarily unavailable (circuit open) — retry shortly.');
    }

    const model = this.resolveModel(opts);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60_000);
    const wallClockStart = Date.now();

    try {
      const res = await fetch(`${this.base}/api/generate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          model,
          prompt: opts.system ? `${opts.system}\n\n${prompt}` : prompt,
          stream: false,
          options: {
            temperature: opts.temperature ?? 0.5,
            num_predict: opts.maxTokens  ?? 512,
          },
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
      // Ollama's own non-streaming response already carries real token counts
      // and duration in nanoseconds -- previously parsed for .response only
      // and the rest discarded. Surfaced here instead of re-measuring wall
      // clock alone (2026-09-08 audit fix, TD-10: this app-wide client had
      // zero latency/token visibility on any call site that used it).
      const json = await res.json() as {
        response: string;
        eval_count?: number;
        prompt_eval_count?: number;
        total_duration?: number;
      };
      const latencyMs = json.total_duration ? Math.round(json.total_duration / 1_000_000) : Date.now() - wallClockStart;
      this.breaker.recordSuccess();
      console.log(`[OllamaClient] model=${model} latencyMs=${latencyMs} promptTokens=${json.prompt_eval_count ?? 'n/a'} completionTokens=${json.eval_count ?? 'n/a'}`);
      return {
        text: json.response.trim(),
        model,
        latencyMs,
        promptTokens: json.prompt_eval_count ?? null,
        completionTokens: json.eval_count ?? null,
      };
    } catch (error) {
      this.breaker.recordFailure();
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const res = await fetch(`${this.base}/api/tags`, { signal: AbortSignal.timeout(5000) });
      return res.ok;
    } catch {
      return false;
    }
  }
}
