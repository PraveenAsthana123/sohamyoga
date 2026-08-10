// Monitoring snapshot for the local-AI operational dashboard.
//
// HONESTY CONTRACT: this module returns only MEASURED data. It never fabricates
// request IDs, latencies, quality scores or savings. When a source is missing,
// the field is empty/zero and `dataSource` downgrades so the UI can say so.
//
// Primary source: the agentic gateway's /metrics (reads tasks.db, traces.jsonl,
// budget.json, Ollama /api/ps+/api/tags on the host). If the gateway is down,
// we degrade to Ollama /api/tags+/api/ps only (still real), and label it.

const AGENT_API_URL = (process.env.AGENT_API_URL || 'http://127.0.0.1:8091').replace(/\/$/, '');
const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');

export interface ActiveRequest {
  requestId: string;
  model: string;
  stage: string;
  status: 'running' | 'queued';
  durationSeconds: number;
  task?: string;
}

export interface ModelMetric {
  name: string;
  requests: number;
  outputTokensPerSecond: number;
  avgLoadMs: number;
  avgTotalMs: number;
  outputTokens: number;
}

export interface MonitoringSnapshot {
  generatedAt: string;
  dataSource: 'live' | 'degraded' | 'offline';
  note: string;
  ollamaUp: boolean;
  installedCount: number;
  loadedModels: Array<{ name: string; vramGb: number }>;
  activeRequests: ActiveRequest[];
  totalRequests: number;
  queueByStatus: Record<string, number>;
  models: ModelMetric[];
  failures: Array<{ reason: string; task?: string }>;
  engineSplit: { localRequests: number; cloudRequests: number; localSharePct: number | null };
  budget: { capUsd: number; spentUsd: number; remainingUsd: number } | null;
  tracedGenerations: number;
  summary: { running: number; queued: number; loaded: number; modelInUse: string };
}

async function fetchJson<T>(url: string, ms = 4000): Promise<T | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// Shape returned by the gateway /metrics endpoint (app/metrics.py).
interface GatewaySnapshot {
  generatedAt: string;
  ollama: { up: boolean; installedCount: number; loadedModels: Array<{ name: string; vramBytes: number }> };
  queue: {
    available: boolean;
    totalRequests: number;
    byStatus: Record<string, number>;
    activeRequests: Array<{ requestId: string; model: string; stage: string; status: string; durationSeconds: number; task?: string }>;
  };
  models: Array<{ name: string; requests: number; outputTokensPerSecond: number; avgLoadMs: number; avgTotalMs: number; outputTokens: number }>;
  failures: Array<{ reason: string; task?: string }>;
  engineSplit: { localRequests: number; cloudRequests: number; localSharePct: number | null };
  budget: { cap_usd: number; spent_usd: number; remaining_usd: number } | null;
  summary: { running: number; queued: number; loaded: number; tracedGenerations: number };
}

function fromGateway(g: GatewaySnapshot): MonitoringSnapshot {
  const loaded = g.ollama.loadedModels.map((m) => ({
    name: m.name,
    vramGb: Math.round(((m.vramBytes || 0) / 1e9) * 10) / 10,
  }));
  const active: ActiveRequest[] = g.queue.activeRequests.map((r) => ({
    requestId: r.requestId,
    model: r.model,
    stage: r.stage,
    status: r.status === 'running' ? 'running' : 'queued',
    durationSeconds: r.durationSeconds,
    task: r.task,
  }));
  return {
    generatedAt: g.generatedAt,
    dataSource: 'live',
    note: 'Measured from the agent gateway (queue, traces, budget, Ollama).',
    ollamaUp: g.ollama.up,
    installedCount: g.ollama.installedCount,
    loadedModels: loaded,
    activeRequests: active,
    totalRequests: g.queue.totalRequests,
    queueByStatus: g.queue.byStatus || {},
    models: g.models || [],
    failures: g.failures || [],
    engineSplit: g.engineSplit,
    budget: g.budget
      ? { capUsd: g.budget.cap_usd, spentUsd: g.budget.spent_usd, remainingUsd: g.budget.remaining_usd }
      : null,
    tracedGenerations: g.summary.tracedGenerations,
    summary: {
      running: g.summary.running,
      queued: g.summary.queued,
      loaded: g.summary.loaded,
      modelInUse: loaded[0]?.name || 'none loaded',
    },
  };
}

// Degraded: gateway unreachable, but we can still read Ollama directly (real).
async function degradedSnapshot(): Promise<MonitoringSnapshot> {
  const tags = await fetchJson<{ models?: Array<{ name: string }> }>(`${OLLAMA_URL}/api/tags`);
  const ps = await fetchJson<{ models?: Array<{ name?: string; model?: string; size_vram?: number }> }>(`${OLLAMA_URL}/api/ps`);
  const up = tags !== null;
  const loaded = (ps?.models || []).map((m) => ({
    name: m.name || m.model || 'unknown',
    vramGb: Math.round(((m.size_vram || 0) / 1e9) * 10) / 10,
  }));
  return {
    generatedAt: new Date().toISOString(),
    dataSource: up ? 'degraded' : 'offline',
    note: up
      ? 'Agent gateway offline — showing live Ollama status only (no queue/trace metrics). Start it: bash agentic-ollama-platform/serve.sh'
      : 'Ollama and the agent gateway are both unreachable.',
    ollamaUp: up,
    installedCount: tags?.models?.length ?? 0,
    loadedModels: loaded,
    activeRequests: [],
    totalRequests: 0,
    queueByStatus: {},
    models: [],
    failures: [],
    engineSplit: { localRequests: 0, cloudRequests: 0, localSharePct: null },
    budget: null,
    tracedGenerations: 0,
    summary: { running: 0, queued: 0, loaded: loaded.length, modelInUse: loaded[0]?.name || 'none loaded' },
  };
}

export async function getMonitoringSnapshot(): Promise<MonitoringSnapshot> {
  const gateway = await fetchJson<GatewaySnapshot>(`${AGENT_API_URL}/metrics`, 5000);
  if (gateway && gateway.ollama) {
    return fromGateway(gateway);
  }
  return degradedSnapshot();
}
