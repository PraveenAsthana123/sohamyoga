// Mandatory operations tracking sweep. Scans every table registered in
// ref_tracked_operation for failure/blocked rows and upserts one
// operations_alert per (source_table, entity_id) — re-seen failures bump
// last_seen_at without touching status.
//
// A resolved alert is a human decision and stays resolved on resweep, even
// though the sweep will keep matching the same underlying row (most tracked
// sources — ui_error_log, api_error_log, test_run, schema_migration_run —
// are append-only logs whose rows never change status themselves, so
// "still findable by the WHERE clause" does not mean "still unresolved").
// An earlier version reopened resolved alerts on every resweep, which
// silently discarded every Resolve click within 10 minutes — found via
// adversarial review, not self-caught. Only an explicit human 'reopen'
// action (see the PATCH route) moves a resolved alert back to open.
//
// Run synchronously on every GET of the operations-alerts admin page (cheap
// indexed queries, always-fresh) and additionally on a cron schedule so
// alerts exist even if nobody has the page open.

import { query } from '../../lib/postgres';
import { ollama } from '../../cron/OllamaClient';

interface SweepFinding {
  sourceTable: string;
  entityId: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  detail: string;
}

async function upsertAlert(f: SweepFinding): Promise<void> {
  const r = await query<{ id: string; is_update: boolean; status: string }>(
    `INSERT INTO operations_alert (source_table, entity_id, severity, title, detail, status, first_seen_at, last_seen_at)
     VALUES ($1,$2,$3,$4,$5,'open',now(),now())
     ON CONFLICT (source_table, entity_id) DO UPDATE SET
       severity = EXCLUDED.severity,
       title = EXCLUDED.title,
       detail = EXCLUDED.detail,
       last_seen_at = now()
     RETURNING id, (xmax != 0) AS is_update, status`,
    [f.sourceTable, f.entityId, f.severity, f.title, f.detail],
  );
  const row = r.rows[0];
  // event_type CHECK constraint only allows found/reseen/acknowledged/
  // resolved/reopened — status is folded into the detail text instead of
  // adding a new event_type value that would need its own migration.
  const detail = row.status === 'resolved' ? `[still present, alert stays resolved] ${f.detail}`.slice(0, 500) : f.detail.slice(0, 500);
  await query(
    `INSERT INTO operations_alert_event (alert_id, event_type, detail) VALUES ($1,$2,$3)`,
    [row.id, row.is_update ? 'reseen' : 'found', detail],
  );
}

async function sweepMarketingProductionJob(): Promise<SweepFinding[]> {
  const r = await query<{ id: string; job_type: string; status: string; error_message: string | null; blocker: string | null }>(
    `SELECT id, job_type, status, error_message, blocker FROM marketing_production_job WHERE status IN ('failed','blocked') AND updated_at > now() - interval '30 days'`,
  );
  return r.rows.map(row => ({
    sourceTable: 'marketing_production_job',
    entityId: row.id,
    severity: row.status === 'failed' ? 'critical' : 'warning',
    title: `${row.job_type} ${row.status}`,
    detail: row.error_message || row.blocker || 'No detail recorded.',
  }));
}

async function sweepMarketingEventLog(): Promise<SweepFinding[]> {
  const r = await query<{ id: string; event_name: string; entity_type: string; entity_id: string | null; outcome: string; details: unknown; occurred_at: string }>(
    `SELECT id, event_name, entity_type, entity_id, outcome, details, occurred_at FROM marketing_event_log WHERE outcome IN ('blocked','failure') AND occurred_at > now() - interval '30 days'`,
  );
  return r.rows.map(row => ({
    sourceTable: 'marketing_event_log',
    entityId: String(row.id),
    severity: row.outcome === 'failure' ? 'critical' : 'warning',
    title: `${row.event_name} (${row.entity_type})`,
    detail: typeof row.details === 'string' ? row.details : JSON.stringify(row.details ?? {}),
  }));
}

async function sweepVoiceCall(): Promise<SweepFinding[]> {
  const r = await query<{ id: string; direction: string; status: string; disposition: string | null }>(
    `SELECT id, direction, status, disposition FROM voice_call WHERE status IN ('failed','blocked') AND created_at > now() - interval '30 days'`,
  );
  return r.rows.map(row => ({
    sourceTable: 'voice_call',
    entityId: row.id,
    severity: 'warning',
    title: `${row.direction} call ${row.status}`,
    detail: row.disposition || 'No disposition recorded.',
  }));
}

async function sweepContentFactoryProject(): Promise<SweepFinding[]> {
  const r = await query<{ id: string; title: string; status: string }>(
    `SELECT id, title, status FROM content_factory_project WHERE status = 'failed' AND updated_at > now() - interval '30 days'`,
  );
  return r.rows.map(row => ({
    sourceTable: 'content_factory_project',
    entityId: row.id,
    severity: 'warning',
    title: `Content project failed: ${row.title}`,
    detail: 'status=failed',
  }));
}

async function sweepJobRun(): Promise<SweepFinding[]> {
  const r = await query<{ id: string; job_name: string; status: string; error_message: string | null }>(
    `SELECT id, job_name, status, error_message FROM job_run WHERE status = 'failed' AND created_at > now() - interval '30 days'`,
  );
  return r.rows.map(row => ({
    sourceTable: 'job_run',
    entityId: row.id,
    severity: 'critical',
    title: `Pipeline job ${row.job_name} failed`,
    detail: row.error_message || 'No error message recorded.',
  }));
}

async function sweepSchemaMigrationRun(): Promise<SweepFinding[]> {
  const r = await query<{ id: string; file_name: string; error_message: string | null }>(
    `SELECT id, file_name, error_message FROM schema_migration_run WHERE status = 'failed' AND completed_at > now() - interval '30 days'`,
  );
  return r.rows.map(row => ({
    sourceTable: 'schema_migration_run',
    entityId: row.id,
    severity: 'critical',
    title: `Migration failed: ${row.file_name}`,
    detail: row.error_message || 'No error message recorded.',
  }));
}

async function sweepApiErrorLog(): Promise<SweepFinding[]> {
  const r = await query<{ id: string; method: string; path: string; error_message: string; occurred_at: string }>(
    `SELECT id, method, path, error_message, occurred_at FROM api_error_log WHERE occurred_at > now() - interval '30 days'`,
  );
  return r.rows.map(row => ({
    sourceTable: 'api_error_log',
    entityId: row.id,
    severity: 'critical',
    title: `${row.method} ${row.path} threw 500`,
    detail: row.error_message,
  }));
}

async function sweepUiErrorLog(): Promise<SweepFinding[]> {
  const r = await query<{ id: string; page_path: string; message: string; occurred_at: string }>(
    `SELECT id, page_path, message, occurred_at FROM ui_error_log WHERE occurred_at > now() - interval '30 days'`,
  );
  return r.rows.map(row => ({
    sourceTable: 'ui_error_log',
    entityId: row.id,
    severity: 'warning',
    title: `Console error on ${row.page_path}`,
    detail: row.message,
  }));
}

async function sweepTestRun(): Promise<SweepFinding[]> {
  // Stable entity_id ("latest") so consecutive failing runs update the same
  // alert (reseen) instead of spawning a new one per run — matches every
  // other sweep function's shape. A clean run produces no finding here; per
  // this whole sweep system's design, resolution is a human action (Manual
  // Process tab), not automatic, so an old alert stays open until reviewed
  // even after the underlying run turns green — intentional, not a bug.
  const r = await query<{ id: string; unexpected: number; expected: number; failing_titles: string[] }>(
    `SELECT id, unexpected, expected, failing_titles FROM test_run
     WHERE id = (SELECT id FROM test_run ORDER BY ran_at DESC LIMIT 1) AND unexpected > 0`,
  );
  return r.rows.map(row => ({
    sourceTable: 'test_run',
    entityId: 'latest',
    severity: 'critical',
    title: `Latest e2e run: ${row.unexpected} unexpected of ${row.expected + row.unexpected}`,
    detail: (row.failing_titles || []).slice(0, 10).join('; '),
  }));
}

async function sweepOllamaCircuitBreaker(): Promise<SweepFinding[]> {
  if (!ollama.circuitOpen()) return [];
  return [{
    sourceTable: 'ollama_circuit_breaker',
    entityId: 'shared-ollama-client',
    severity: 'critical',
    title: 'Local Ollama circuit breaker is open',
    detail: 'Repeated failures against the local Ollama daemon tripped the breaker — cron jobs relying on Ollama are fast-failing until it cools down.',
  }];
}

export async function runOperationsAlertSweep(): Promise<{ findings: number }> {
  const results = await Promise.allSettled([
    sweepMarketingProductionJob(),
    sweepMarketingEventLog(),
    sweepVoiceCall(),
    sweepContentFactoryProject(),
    sweepJobRun(),
    sweepOllamaCircuitBreaker(),
    sweepSchemaMigrationRun(),
    sweepApiErrorLog(),
    sweepUiErrorLog(),
    sweepTestRun(),
  ]);
  const findings = results.flatMap(r => (r.status === 'fulfilled' ? r.value : []));
  for (const f of findings) await upsertAlert(f);
  return { findings: findings.length };
}
