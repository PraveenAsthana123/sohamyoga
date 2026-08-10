// Ollama API client for all cron jobs.
// All AI work runs locally — no cloud tokens consumed.
// Model tiers follow the oll router: fast / code / strong.

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';

export const OLLAMA_MODELS = {
  fast:   process.env.OLLAMA_MODEL_FAST   ?? 'phi3:mini',
  code:   process.env.OLLAMA_MODEL_CODE   ?? 'deepseek-coder:6.7b',
  strong: process.env.OLLAMA_MODEL_STRONG ?? 'llama3.2:latest',
} as const;

export type OllamaModelTier = keyof typeof OLLAMA_MODELS;

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateOptions {
  model?:       string;
  tier?:        OllamaModelTier;
  system?:      string;
  temperature?: number;
  maxTokens?:   number;
  timeoutMs?:   number;
}

export class OllamaClient {
  private readonly base: string;

  constructor(base = OLLAMA_BASE) {
    this.base = base;
  }

  private resolveModel(opts: GenerateOptions): string {
    if (opts.model) return opts.model;
    return OLLAMA_MODELS[opts.tier ?? 'fast'];
  }

  async generate(prompt: string, opts: GenerateOptions = {}): Promise<string> {
    const model = this.resolveModel(opts);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60_000);

    try {
      const res = await fetch(`${this.base}/api/generate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          model,
          prompt: opts.system ? `${opts.system}\n\n${prompt}` : prompt,
          stream: false,
          options: {
            temperature: opts.temperature ?? 0.7,
            num_predict: opts.maxTokens  ?? 512,
          },
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
      const json = await res.json() as { response: string };
      return json.response.trim();
    } finally {
      clearTimeout(timeout);
    }
  }

  async chat(messages: OllamaMessage[], opts: GenerateOptions = {}): Promise<string> {
    const model = this.resolveModel(opts);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 90_000);

    try {
      const res = await fetch(`${this.base}/api/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          model,
          messages,
          stream: false,
          options: { temperature: opts.temperature ?? 0.7, num_predict: opts.maxTokens ?? 1024 },
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Ollama chat ${res.status}: ${await res.text()}`);
      const json = await res.json() as { message: { content: string } };
      return json.message.content.trim();
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

export const ollama = new OllamaClient();
