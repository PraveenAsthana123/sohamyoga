// Server-side client for the agentic Ollama gateway (FastAPI).
//
// The gateway plans a goal into tasks with a local Ollama model and queues them;
// a cron worker executes them locally. Kept server-only so the gateway URL is
// never exposed to the browser — the portal calls same-origin /api/ai/agent/*.
import { finishOperation, recordCircuit, recordError, startOperation } from './operation-ledger';
//
// Env AGENT_API_URL — base URL of the gateway. In docker use
// http://host.docker.internal:8091 to reach the host process.
export const AGENT_API_URL = (process.env.AGENT_API_URL || 'http://127.0.0.1:8091').replace(/\/$/, '');

const TIMEOUT_MS = 120000; // planning calls Ollama; allow for a cold model load.

async function agentFetch(path: string, init?: RequestInit) {
  const run = await startOperation({ componentKey: 'soham-next', operationType: 'integration_call', operationName: `ollama-director ${init?.method || 'GET'} ${path}`, source: 'next-server', input: { path, method: init?.method || 'GET' } });
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${AGENT_API_URL}${path}`, { ...init, signal: controller.signal, headers: { ...init?.headers, 'x-trace-id': run.traceId } });
    await recordCircuit('soham-next','ollama-director',res.ok);
    await finishOperation(run,res.ok ? 'succeeded' : 'failed',{ status: res.status });
    return res;
  } catch (error) {
    await recordCircuit('soham-next','ollama-director',false);
    await recordError(run,'soham-next',error,{ path });
    await finishOperation(run,error instanceof DOMException && error.name === 'AbortError' ? 'timeout' : 'failed');
    throw error;
  } finally {
    clearTimeout(t);
  }
}

export async function submitGoal(goal: string) {
  const res = await agentFetch('/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal }),
  });
  if (!res.ok) throw new Error(`gateway /submit ${res.status}`);
  return res.json();
}

export async function requestStatus(rid: number | string) {
  const res = await agentFetch(`/request/${rid}`);
  if (!res.ok) throw new Error(`gateway /request/${rid} ${res.status}`);
  return res.json();
}

export async function agentHealth() {
  try {
    const res = await agentFetch('/health', { method: 'GET' });
    if (!res.ok) return { ok: false as const, url: AGENT_API_URL };
    const data = (await res.json()) as { ollama?: boolean };
    return { ok: Boolean(data.ollama), url: AGENT_API_URL };
  } catch (e) {
    return { ok: false as const, url: AGENT_API_URL, error: e instanceof Error ? e.message : String(e) };
  }
}
