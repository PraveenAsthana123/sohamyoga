// Shared OpenBao (Vault-compatible) KV-v2 REST helper. Factors out the
// fetch-based pattern already proven in src/app/api/config/credentials/route.ts
// and src/lib/skyvern.ts (each still has its own inline copy — not touched
// here to avoid risking already-working code; see
// src/domain/ingestion/integration-spec.md for the consolidation note).

const OPENBAO_BASE = process.env.OPENBAO_ADDR ?? 'http://localhost:8200';
const OPENBAO_TOKEN = process.env.OPENBAO_ROOT_TOKEN ?? '';

/** Writes `data` to a KV-v2 path and returns a `vault://` reference string — never the raw data. */
export async function vaultWrite(path: string, data: Record<string, string>): Promise<string> {
  const res = await fetch(`${OPENBAO_BASE}/v1/secret/data/${path}`, {
    method: 'POST',
    headers: { 'X-Vault-Token': OPENBAO_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) {
    throw new Error(`Vault write failed (HTTP ${res.status}) for path ${path}`);
  }
  return `vault://secret/data/${path}`;
}

/** Reads back a secret given its `vault://secret/data/<path>` reference. Returns null if unreachable/missing. */
export async function vaultRead<T = Record<string, string>>(reference: string): Promise<T | null> {
  if (!reference.startsWith('vault://secret/data/')) {
    throw new Error(`Not a valid vault reference: ${reference}`);
  }
  const path = reference.slice('vault://secret/data/'.length);
  try {
    const res = await fetch(`${OPENBAO_BASE}/v1/secret/data/${path}`, {
      headers: { 'X-Vault-Token': OPENBAO_TOKEN },
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { data?: T } };
    return body.data?.data ?? null;
  } catch {
    return null;
  }
}
