// Real Ollama task dispatcher
// Maps task types to best available models and executes them

export type OllamaTaskType =
  | 'text_generation'
  | 'code_generation'
  | 'code_review'
  | 'summarization'
  | 'classification'
  | 'entity_extraction'
  | 'sentiment_analysis'
  | 'translation'
  | 'reasoning'
  | 'planning'
  | 'tool_use'
  | 'content_safety'
  | 'embedding'
  | 'qa'
  | 'marketing_copy'
  | 'email_draft'
  | 'seo_analysis'
  | 'data_analysis';

// Model preference order per task type (first available wins)
const TASK_MODEL_MAP: Record<OllamaTaskType, string[]> = {
  text_generation:    ['qwen3:8b', 'llama3.1:8b', 'mistral:latest', 'llama3:latest'],
  code_generation:    ['qwen2.5-coder:latest', 'deepseek-coder-v2:latest', 'qwen2.5-coder:14b', 'codegemma:7b'],
  code_review:        ['code-reviewer:latest', 'qwen2.5-coder:latest', 'deepseek-coder-v2:latest'],
  summarization:      ['qwen2.5:latest', 'qwen3:8b', 'mistral:latest'],
  classification:     ['qwen3:8b', 'gemma3:4b', 'mistral:latest'],
  entity_extraction:  ['qwen3:8b', 'llama3.1:8b', 'mistral:latest'],
  sentiment_analysis: ['qwen3:8b', 'gemma2:9b', 'mistral:latest'],
  translation:        ['qwen2.5:latest', 'qwen3:8b', 'llama3:latest'],
  reasoning:          ['deepseek-r1:8b', 'qwen3:8b', 'phi4:14b'],
  planning:           ['qwen3:8b', 'llama3.1:8b', 'deepseek-r1:8b'],
  tool_use:           ['llama3-groq-tool-use:latest', 'qwen3:8b', 'llama3.1:8b'],
  content_safety:     ['llama-guard3:latest', 'shieldgemma:9b'],
  embedding:          ['nomic-embed-text:latest', 'mxbai-embed-large:latest', 'bge-m3:latest'],
  qa:                 ['qwen3:8b', 'llama3.1:8b', 'mistral:latest'],
  marketing_copy:     ['qwen2.5:latest', 'qwen3:8b', 'llama3.1:8b'],
  email_draft:        ['qwen2.5:latest', 'qwen3:8b', 'mistral:latest'],
  seo_analysis:       ['qwen3:8b', 'qwen2.5:latest', 'llama3.1:8b'],
  data_analysis:      ['deepseek-r1:8b', 'qwen3:8b', 'qwen2.5:latest'],
};

export interface DispatchResult {
  task_type: OllamaTaskType;
  model_used: string;
  output: string;
  latency_ms: number;
  tokens_estimated: number;
  status: 'completed' | 'fallback_used' | 'ollama_offline' | 'failed';
  error?: string;
}

// Get live model list from Ollama (cached per call)
let cachedModels: string[] | null = null;
let cacheTime = 0;

export async function getLiveModels(): Promise<string[]> {
  const now = Date.now();
  if (cachedModels && now - cacheTime < 60000) return cachedModels;
  try {
    const res = await fetch('http://localhost:11434/api/tags', {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return cachedModels ?? [];
    const data = await res.json() as { models?: { name: string }[] };
    cachedModels = (data.models ?? []).map((m: { name: string }) => m.name);
    cacheTime = now;
    return cachedModels;
  } catch {
    return cachedModels ?? [];
  }
}

// Pick the best available model for a task type
export async function selectModel(taskType: OllamaTaskType): Promise<string | null> {
  const preferences = TASK_MODEL_MAP[taskType] ?? TASK_MODEL_MAP.text_generation;
  const available = await getLiveModels();
  for (const preferred of preferences) {
    if (available.includes(preferred)) return preferred;
    // Also check prefix match (e.g. "qwen3" matches "qwen3:latest")
    const prefix = preferred.split(':')[0] + ':';
    const found = available.find(a => a.startsWith(prefix));
    if (found) return found;
  }
  // Fallback: any available non-embedding, non-safety model
  return available.find(m =>
    !m.includes('embed') &&
    !m.includes('guard') &&
    !m.includes('shield')
  ) ?? null;
}

// Execute a task via Ollama
export async function dispatchToOllama(
  taskType: OllamaTaskType,
  prompt: string,
  options: { temperature?: number; maxTokens?: number; systemPrompt?: string } = {}
): Promise<DispatchResult> {
  const start = Date.now();
  const model = await selectModel(taskType);

  if (!model) {
    return {
      task_type: taskType,
      model_used: 'none',
      output: 'Ollama is offline or no models available',
      latency_ms: Date.now() - start,
      tokens_estimated: 0,
      status: 'ollama_offline',
    };
  }

  const messages = options.systemPrompt
    ? [
        { role: 'system', content: options.systemPrompt },
        { role: 'user', content: prompt },
      ]
    : undefined;

  const body = messages
    ? { model, messages, stream: false, options: { temperature: options.temperature ?? 0.7 } }
    : { model, prompt, stream: false, options: { temperature: options.temperature ?? 0.7 } };

  const endpoint = messages ? '/api/chat' : '/api/generate';

  try {
    const res = await fetch(`http://localhost:11434${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) throw new Error(`Ollama ${res.status}: ${res.statusText}`);
    const data = await res.json() as { response?: string; message?: { content?: string } };
    const output = data.response ?? data.message?.content ?? '';
    const latency = Date.now() - start;

    return {
      task_type: taskType,
      model_used: model,
      output,
      latency_ms: latency,
      tokens_estimated: Math.round(output.length / 4),
      status: 'completed',
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      task_type: taskType,
      model_used: model,
      output: `Execution failed: ${errMsg}`,
      latency_ms: Date.now() - start,
      tokens_estimated: 0,
      status: 'failed',
      error: errMsg,
    };
  }
}

export interface TaskModelInfo {
  task_type: string;
  preferred_models: string[];
  selected_model: string | null;
  available: boolean;
}

// Get full task-to-model mapping (for UI display)
export async function getTaskModelMapping(): Promise<TaskModelInfo[]> {
  // Pre-fetch once so selectModel calls hit the cache
  await getLiveModels();
  return Promise.all(
    (Object.keys(TASK_MODEL_MAP) as OllamaTaskType[]).map(async (taskType) => {
      const model = await selectModel(taskType);
      return {
        task_type: taskType,
        preferred_models: TASK_MODEL_MAP[taskType],
        selected_model: model,
        available: model !== null,
      };
    })
  );
}

// Convenience: run a prompt with automatic task-type detection and Ollama-first routing
// Drop-in replacement for raw fetch('http://localhost:11434/api/generate', ...)
export async function ollamaFirst(
  prompt: string,
  options: {
    taskType?: OllamaTaskType;
    preferredModel?: string;  // override model selection
    temperature?: number;
    systemPrompt?: string;
  } = {}
): Promise<{ text: string; model: string; latency_ms: number; online: boolean }> {
  const taskType = options.taskType ?? 'text_generation';
  const model = options.preferredModel ?? await selectModel(taskType);

  if (!model) {
    return { text: '', model: 'none', latency_ms: 0, online: false };
  }

  const start = Date.now();
  try {
    const body = options.systemPrompt
      ? { model, messages: [{ role: 'system', content: options.systemPrompt }, { role: 'user', content: prompt }], stream: false, options: { temperature: options.temperature ?? 0.7 } }
      : { model, prompt, stream: false, options: { temperature: options.temperature ?? 0.7 } };
    const endpoint = options.systemPrompt ? '/api/chat' : '/api/generate';
    const res = await fetch(`http://localhost:11434${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const d = await res.json() as { response?: string; message?: { content?: string } };
    return {
      text: d.response ?? d.message?.content ?? '',
      model,
      latency_ms: Date.now() - start,
      online: true,
    };
  } catch {
    return { text: '', model, latency_ms: Date.now() - start, online: false };
  }
}
