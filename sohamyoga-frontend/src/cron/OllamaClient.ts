// Ollama API client for all cron jobs.
// All AI work runs locally — no cloud tokens consumed.
// Model tiers follow the oll router: fast / code / strong.

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';

// BUG FIX (2026-09-09): the frontend container's real env only sets
// OLLAMA_MODEL/OLLAMA_URL (for lib/ollama.ts) -- it has no
// OLLAMA_MODEL_STRONG or OLLAMA_MODEL_CODE override (confirmed live via
// `docker exec sohamyoga-frontend env`), unlike the cron container which
// does set them. So every frontend API route using tier:'strong' (at
// least 15 real call sites: ViralAmplificationGenerator, AdCreativeGenerator,
// LandingPageGenerator, CampaignContentGenerator, ReviewResponseDrafter,
// VideoScriptGenerator, and more) was silently falling back to the
// hardcoded defaults below -- 'llama3.2:3b' and 'deepseek-coder:6.7b-instruct'
// -- neither of which is installed on this machine (`ollama list` / `/api/tags`
// checked live), so every one of those real, already-shipped features (e.g.
// the "Generate hooks" amplify button) would fail with a 404 model-not-found
// error in production. Fixed the hardcoded fallbacks to match the real
// installed models / the cron container's actual working values, so the
// frontend behaves correctly even without the env override present.
export const OLLAMA_MODELS = {
  fast:   process.env.OLLAMA_MODEL_FAST   ?? 'phi4-mini:latest',
  code:   process.env.OLLAMA_MODEL_CODE   ?? 'qwen2.5-coder:latest',
  strong: process.env.OLLAMA_MODEL_STRONG ?? 'qwen2.5:latest',
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
