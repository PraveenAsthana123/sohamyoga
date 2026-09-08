import { query } from '@/lib/db';
import { isOwnedAssistantId } from '@/domain/script/repository';

/**
 * The ONLY module in this app allowed to call api.vapi.ai directly.
 * VapiAssistantSync.ts and VapiCallAdapter.ts must go through this, not
 * fetch() directly -- this is the fix for the real tenant-isolation gap
 * found live 2026-09-02 (this account also holds an unrelated production
 * assistant, "Domino's Pizza-Inbound Call", for a real client).
 *
 * Guarantee: any request that targets a specific assistantId is checked
 * against isOwnedAssistantId() first. An assistant this app did not itself
 * create (i.e. has no row in call_script_version.vapi_assistant_id) is
 * REFUSED, not silently allowed -- creating a NEW assistant (no assistantId
 * yet) is unaffected. Every call, blocked or not, is written to
 * vapi_api_audit_log so "what did this app ever touch on this account" is
 * answerable after the fact.
 */
export class VapiTenantIsolationError extends Error {
  constructor(assistantId: string) {
    super(`Refusing to call Vapi for assistant ${assistantId} -- it was not created by this app (no record in vapi_created_assistant, the append-only log of assistants this app actually created via a real POST). This account also holds unrelated real client assistants; only self-created assistants may be touched.`);
    this.name = 'VapiTenantIsolationError';
  }
}

interface VapiRequestOptions {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  assistantId?: string;
  initiatedBy: string;
}

async function logAudit(entry: {
  method: string; path: string; assistantId: string | null; blocked: boolean;
  success: boolean | null; statusCode: number | null; errorMessage: string | null;
  durationMs: number; initiatedBy: string;
}): Promise<void> {
  await query(
    `INSERT INTO vapi_api_audit_log
       (method, path, assistant_id, blocked, success, status_code, error_message, duration_ms, initiated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [entry.method, entry.path, entry.assistantId, entry.blocked, entry.success,
      entry.statusCode, entry.errorMessage, entry.durationMs, entry.initiatedBy]
  );
}

export async function vapiRequest<T>(opts: VapiRequestOptions): Promise<T> {
  const apiKey = process.env.VAPI_API_KEY?.trim();
  if (!apiKey) throw new Error('VAPI_API_KEY is not set.');

  const start = Date.now();

  if (opts.assistantId) {
    const owned = await isOwnedAssistantId(opts.assistantId);
    if (!owned) {
      await logAudit({
        method: opts.method, path: opts.path, assistantId: opts.assistantId, blocked: true,
        success: null, statusCode: null, errorMessage: 'not owned by this app', durationMs: Date.now() - start,
        initiatedBy: opts.initiatedBy,
      });
      throw new VapiTenantIsolationError(opts.assistantId);
    }
  }

  try {
    const res = await fetch(`https://api.vapi.ai${opts.path}`, {
      method: opts.method,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    const durationMs = Date.now() - start;

    if (!res.ok) {
      await logAudit({
        method: opts.method, path: opts.path, assistantId: opts.assistantId ?? null, blocked: false,
        success: false, statusCode: res.status, errorMessage: text.slice(0, 500), durationMs,
        initiatedBy: opts.initiatedBy,
      });
      throw new Error(`Vapi ${opts.method} ${opts.path} failed: ${res.status} ${text.slice(0, 300)}`);
    }

    await logAudit({
      method: opts.method, path: opts.path, assistantId: opts.assistantId ?? null, blocked: false,
      success: true, statusCode: res.status, errorMessage: null, durationMs, initiatedBy: opts.initiatedBy,
    });
    return (text ? JSON.parse(text) : null) as T;
  } catch (err) {
    if (err instanceof VapiTenantIsolationError) throw err;
    if (!(err instanceof Error) || !err.message.startsWith('Vapi ')) {
      await logAudit({
        method: opts.method, path: opts.path, assistantId: opts.assistantId ?? null, blocked: false,
        success: false, statusCode: null, errorMessage: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start, initiatedBy: opts.initiatedBy,
      });
    }
    throw err;
  }
}
