// Real integration health checks — replaces a fabricated hardcoded connection
// list (previously in admin/integrations/page.tsx: 14 services incl. Keycloak/
// Qdrant/Zoom/Mattermost with fake "connected" status and made-up health/call/
// error numbers). Only services this repo actually runs get a real check;
// everything else is honestly "not_configured", never fabricated.

import { databaseConfigured, query } from './postgres';
import { ollamaHealth, OLLAMA_URL } from './ollama';

export type IntegrationStatus = 'connected' | 'degraded' | 'not_configured' | 'error';

export interface IntegrationCheckResult {
  name: string;
  category: string;
  status: IntegrationStatus;
  latencyMs: number | null;
  detail: string;
}

async function timedFetch(url: string, timeoutMs = 5_000): Promise<{ ok: boolean; status: number; ms: number }> {
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return { ok: res.ok, status: res.status, ms: Date.now() - start };
  } catch {
    return { ok: false, status: 0, ms: Date.now() - start };
  }
}

async function checkPostgres(): Promise<IntegrationCheckResult> {
  const base = { name: 'PostgreSQL', category: 'Database' };
  if (!databaseConfigured()) return { ...base, status: 'not_configured', latencyMs: null, detail: 'DATABASE_URL not set' };
  const start = Date.now();
  try {
    await query('SELECT 1');
    return { ...base, status: 'connected', latencyMs: Date.now() - start, detail: 'SELECT 1 succeeded' };
  } catch (err) {
    return { ...base, status: 'error', latencyMs: Date.now() - start, detail: err instanceof Error ? err.message : 'query failed' };
  }
}

async function checkOllama(): Promise<IntegrationCheckResult> {
  const base = { name: 'Ollama', category: 'AI' };
  const start = Date.now();
  const health = await ollamaHealth();
  const ms = Date.now() - start;
  if (health.ok) return { ...base, status: 'connected', latencyMs: ms, detail: `${health.models?.length ?? 0} model(s) loaded at ${OLLAMA_URL}` };
  return { ...base, status: 'error', latencyMs: ms, detail: `Unreachable at ${OLLAMA_URL}` };
}

async function checkOpenBao(): Promise<IntegrationCheckResult> {
  const base = { name: 'OpenBao', category: 'Secrets' };
  const addr = process.env.OPENBAO_ADDR;
  if (!addr) return { ...base, status: 'not_configured', latencyMs: null, detail: 'OPENBAO_ADDR not set' };
  const r = await timedFetch(`${addr}/v1/sys/health`);
  return { ...base, status: r.ok ? 'connected' : 'error', latencyMs: r.ms, detail: r.ok ? 'sys/health OK' : `HTTP ${r.status || 'unreachable'}` };
}

async function checkPostiz(): Promise<IntegrationCheckResult> {
  const base = { name: 'Postiz', category: 'Social Publishing' };
  const url = process.env.POSTIZ_CLIENT_URL;
  if (!url) return { ...base, status: 'not_configured', latencyMs: null, detail: 'POSTIZ_CLIENT_URL not set' };
  // Postiz's frontend returns a redirect (307) when healthy, not 200 — confirmed
  // this session against the live container; a bare fetch() follows the
  // redirect by default so a 2xx here already implies the 307 was healthy.
  const r = await timedFetch(url);
  return { ...base, status: r.ok ? 'connected' : 'error', latencyMs: r.ms, detail: r.ok ? `responded (final HTTP ${r.status})` : `HTTP ${r.status || 'unreachable'}` };
}

async function checkActivepieces(): Promise<IntegrationCheckResult> {
  const base = { name: 'Activepieces', category: 'Workflow Orchestration' };
  const url = process.env.ACTIVEPIECES_URL || 'http://127.0.0.1:18181';
  const r = await timedFetch(`${url}/api/v1/health`);
  return { ...base, status: r.ok ? 'connected' : 'not_configured', latencyMs: r.ms, detail: r.ok ? 'api/v1/health OK' : `HTTP ${r.status || 'unreachable'}` };
}

const CHECKS: Array<() => Promise<IntegrationCheckResult>> = [
  checkPostgres, checkOllama, checkOpenBao, checkPostiz, checkActivepieces,
];

export async function getIntegrationHealth(): Promise<IntegrationCheckResult[]> {
  return Promise.all(CHECKS.map(fn => fn()));
}
