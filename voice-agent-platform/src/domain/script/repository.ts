import { query, pool } from '@/lib/db';
import { CallScript, CallScriptProps, ClinicServiceType, CallScriptDirection } from './CallScript';
import { CallScriptVersion, CallScriptVersionProps, CallScriptSections, CallScriptVersionStatus, VapiAdvancedConfig } from './CallScriptVersion';

interface ScriptRow {
  id: string;
  slug: string;
  name: string;
  service_type: ClinicServiceType;
  direction: CallScriptDirection;
  scenario_key: string | null;
  category: string | null;
  owner_customer_id: string | null;
  published_version_id: string | null;
  created_at: Date;
  updated_at: Date;
}

interface VersionRow {
  id: string;
  script_id: string;
  version_number: number;
  sections: CallScriptSections;
  status: CallScriptVersionStatus;
  created_by: string;
  created_at: Date;
  vapi_assistant_id: string | null;
  vapi_synced_at: Date | null;
  vapi_sync_error: string | null;
  vapi_model_provider: string;
  vapi_model: string;
  vapi_voice_provider: string;
  vapi_voice_id: string;
  vapi_transcriber_provider: string;
  vapi_transcriber_model: string;
  vapi_transcriber_language: string;
  vapi_end_call_message: string;
  vapi_silence_timeout_seconds: number;
  vapi_max_duration_seconds: number;
}

function scriptToEntity(row: ScriptRow): CallScript {
  const props: CallScriptProps = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    serviceType: row.service_type,
    direction: row.direction,
    scenarioKey: row.scenario_key,
    category: row.category,
    ownerCustomerId: row.owner_customer_id,
    publishedVersionId: row.published_version_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
  return new CallScript(props);
}

function versionToEntity(row: VersionRow): CallScriptVersion {
  const props: CallScriptVersionProps = {
    id: row.id,
    scriptId: row.script_id,
    versionNumber: row.version_number,
    sections: row.sections,
    status: row.status,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
    vapiAssistantId: row.vapi_assistant_id,
    vapiSyncedAt: row.vapi_synced_at ? new Date(row.vapi_synced_at) : null,
    vapiSyncError: row.vapi_sync_error,
    vapiConfig: {
      modelProvider: row.vapi_model_provider, model: row.vapi_model,
      voiceProvider: row.vapi_voice_provider, voiceId: row.vapi_voice_id,
      transcriberProvider: row.vapi_transcriber_provider, transcriberModel: row.vapi_transcriber_model,
      transcriberLanguage: row.vapi_transcriber_language, endCallMessage: row.vapi_end_call_message,
      silenceTimeoutSeconds: row.vapi_silence_timeout_seconds, maxDurationSeconds: row.vapi_max_duration_seconds,
    },
  };
  return new CallScriptVersion(props);
}

export async function listScripts(): Promise<CallScript[]> {
  const { rows } = await query<ScriptRow>('SELECT * FROM call_script ORDER BY created_at DESC');
  return rows.map(scriptToEntity);
}

export async function getScript(id: string): Promise<CallScript | null> {
  const { rows } = await query<ScriptRow>('SELECT * FROM call_script WHERE id = $1', [id]);
  return rows[0] ? scriptToEntity(rows[0]) : null;
}

export async function listVersions(scriptId: string): Promise<CallScriptVersion[]> {
  const { rows } = await query<VersionRow>(
    'SELECT * FROM call_script_version WHERE script_id = $1 ORDER BY version_number DESC',
    [scriptId]
  );
  return rows.map(versionToEntity);
}

export async function getVersion(id: string): Promise<CallScriptVersion | null> {
  const { rows } = await query<VersionRow>('SELECT * FROM call_script_version WHERE id = $1', [id]);
  return rows[0] ? versionToEntity(rows[0]) : null;
}

/** Tenant-isolation guard: this app must NEVER read/write a Vapi assistant
 * it did not itself create -- the real Vapi account this key belongs to
 * also holds unrelated production assistants for other clients (confirmed
 * live 2026-09-02: a real "Domino's Pizza-Inbound Call" assistant). The only
 * safe allowlist is "an assistant ID this app's own DB says it created." */
/** Checks the append-only vapi_created_assistant log, NOT
 * call_script_version.vapi_assistant_id -- that column is freely mutable by
 * application code (and, as happened in a real 2026-09-02 incident, by a
 * direct DB write during testing), which made the previous version of this
 * check self-referential: writing a foreign assistant ID into our own
 * tracking column made it look "owned," and a real PATCH went through
 * against IBM's actual production "Domino's Pizza-Inbound Call" assistant.
 * An assistant ID is only ever real-owned if this app's own code actually
 * created it via a successful POST to Vapi (see recordVapiAssistantCreated). */
export async function isOwnedAssistantId(assistantId: string): Promise<boolean> {
  const { rows } = await query<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM vapi_created_assistant WHERE assistant_id = $1) AS exists',
    [assistantId]
  );
  return rows[0]?.exists ?? false;
}

/** Called ONLY from the real Vapi-creation success path (POST /assistant,
 * not PATCH) -- this is the sole way a row enters the ownership log. */
export async function recordVapiAssistantCreated(assistantId: string, scriptVersionId: string): Promise<void> {
  await query(
    'INSERT INTO vapi_created_assistant (assistant_id, script_version_id) VALUES ($1, $2) ON CONFLICT (assistant_id) DO NOTHING',
    [assistantId, scriptVersionId]
  );
}

export interface CreateScriptInput {
  slug: string;
  name: string;
  serviceType: ClinicServiceType;
  direction: CallScriptDirection;
  scenarioKey?: string;
  category?: string;
  sections: CallScriptSections;
  createdBy?: string;
}

/** Creates a new call_script family along with its first draft version (v1). */
export async function createScript(input: CreateScriptInput): Promise<{ script: CallScript; version: CallScriptVersion }> {
  // Validate shape via entities before writing.
  new CallScript({
    id: '00000000-0000-0000-0000-000000000000',
    slug: input.slug,
    name: input.name,
    serviceType: input.serviceType,
    direction: input.direction,
    scenarioKey: input.scenarioKey ?? null,
    category: input.category ?? null,
    ownerCustomerId: null,
    publishedVersionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  new CallScriptVersion({
    id: '00000000-0000-0000-0000-000000000000',
    scriptId: '00000000-0000-0000-0000-000000000000',
    versionNumber: 1,
    sections: input.sections,
    status: 'draft',
    createdBy: input.createdBy ?? 'admin',
    createdAt: new Date(),
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const scriptResult = await client.query<ScriptRow>(
      `INSERT INTO call_script (slug, name, service_type, direction, scenario_key, category) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [input.slug, input.name, input.serviceType, input.direction, input.scenarioKey ?? null, input.category ?? null]
    );
    const versionResult = await client.query<VersionRow>(
      `INSERT INTO call_script_version (script_id, version_number, sections, status, created_by)
       VALUES ($1, 1, $2, 'draft', $3) RETURNING *`,
      [scriptResult.rows[0].id, JSON.stringify(input.sections), input.createdBy ?? 'admin']
    );
    await client.query('COMMIT');
    return { script: scriptToEntity(scriptResult.rows[0]), version: versionToEntity(versionResult.rows[0]) };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Adds a new draft version on top of the latest existing version for a script. */
export async function createDraftVersion(scriptId: string, sections: CallScriptSections, createdBy = 'admin'): Promise<CallScriptVersion> {
  new CallScriptVersion({
    id: '00000000-0000-0000-0000-000000000000',
    scriptId,
    versionNumber: 1,
    sections,
    status: 'draft',
    createdBy,
    createdAt: new Date(),
  });

  const { rows } = await query<{ next: number }>(
    'SELECT COALESCE(MAX(version_number), 0) + 1 AS next FROM call_script_version WHERE script_id = $1',
    [scriptId]
  );
  const nextVersion = rows[0]?.next ?? 1;

  const result = await query<VersionRow>(
    `INSERT INTO call_script_version (script_id, version_number, sections, status, created_by)
     VALUES ($1, $2, $3, 'draft', $4) RETURNING *`,
    [scriptId, nextVersion, JSON.stringify(sections), createdBy]
  );
  return versionToEntity(result.rows[0]);
}

/** Publishes a draft version: archives the previously-published version (if
 * any) and points call_script.published_version_id at the new one. History
 * is preserved — nothing is overwritten or deleted. */
export async function publishVersion(scriptId: string, versionId: string): Promise<CallScriptVersion> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const versionResult = await client.query<VersionRow>('SELECT * FROM call_script_version WHERE id = $1 AND script_id = $2 FOR UPDATE', [
      versionId,
      scriptId,
    ]);
    const versionRow = versionResult.rows[0];
    if (!versionRow) throw new Error('Version not found for this script.');
    if (versionRow.status !== 'draft') throw new Error('Only a draft version can be published.');

    const scriptResult = await client.query<ScriptRow>('SELECT * FROM call_script WHERE id = $1 FOR UPDATE', [scriptId]);
    const scriptRow = scriptResult.rows[0];
    if (!scriptRow) throw new Error('Script not found.');

    if (scriptRow.published_version_id) {
      await client.query(`UPDATE call_script_version SET status = 'archived' WHERE id = $1 AND status = 'published'`, [
        scriptRow.published_version_id,
      ]);
    }
    const updatedVersion = await client.query<VersionRow>(
      `UPDATE call_script_version SET status = 'published' WHERE id = $1 RETURNING *`,
      [versionId]
    );
    await client.query('UPDATE call_script SET published_version_id = $2, updated_at = now() WHERE id = $1', [scriptId, versionId]);
    await client.query('COMMIT');
    return versionToEntity(updatedVersion.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Records the outcome of a real Vapi sync attempt -- success clears any
 * prior error and stamps vapi_synced_at; failure records the error and
 * leaves vapi_synced_at untouched (never fabricates a successful sync). */
export async function recordVapiSyncSuccess(versionId: string, assistantId: string): Promise<CallScriptVersion> {
  const { rows } = await query<VersionRow>(
    `UPDATE call_script_version SET vapi_assistant_id = $2, vapi_synced_at = now(), vapi_sync_error = NULL WHERE id = $1 RETURNING *`,
    [versionId, assistantId],
  );
  if (!rows[0]) throw new Error('Version not found.');
  return versionToEntity(rows[0]);
}

/** Updates the advanced Vapi config (model/voice/transcriber/limits) for a
 * version. Validated via the CallScriptVersion entity before writing. */
export async function updateVapiConfig(versionId: string, config: VapiAdvancedConfig): Promise<CallScriptVersion> {
  const existing = await getVersion(versionId);
  if (!existing) throw new Error('Version not found.');
  existing.withVapiConfig(config); // throws if invalid

  const { rows } = await query<VersionRow>(
    `UPDATE call_script_version SET
       vapi_model_provider = $2, vapi_model = $3, vapi_voice_provider = $4, vapi_voice_id = $5,
       vapi_transcriber_provider = $6, vapi_transcriber_model = $7, vapi_transcriber_language = $8,
       vapi_end_call_message = $9, vapi_silence_timeout_seconds = $10, vapi_max_duration_seconds = $11
     WHERE id = $1 RETURNING *`,
    [versionId, config.modelProvider, config.model, config.voiceProvider, config.voiceId,
     config.transcriberProvider, config.transcriberModel, config.transcriberLanguage,
     config.endCallMessage, config.silenceTimeoutSeconds, config.maxDurationSeconds],
  );
  return versionToEntity(rows[0]);
}

export async function recordVapiSyncFailure(versionId: string, errorMessage: string): Promise<void> {
  await query(`UPDATE call_script_version SET vapi_sync_error = $2 WHERE id = $1`, [versionId, errorMessage.slice(0, 500)]);
}

export interface VapiSyncLogEntry {
  id: string; action: 'create' | 'update'; success: boolean; assistantId: string | null;
  errorMessage: string | null; durationMs: number; initiatedBy: string; createdAt: Date;
}

/** Appends one row to the real sync-attempt trace log -- every attempt,
 * success or failure, so history survives even after the version's own
 * current-state columns get overwritten by a later attempt. */
export async function appendVapiSyncLog(entry: {
  versionId: string; action: 'create' | 'update'; success: boolean; assistantId?: string | null;
  errorMessage?: string | null; durationMs: number; initiatedBy: string;
}): Promise<void> {
  await query(
    `INSERT INTO vapi_sync_log (script_version_id, action, success, assistant_id, error_message, duration_ms, initiated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [entry.versionId, entry.action, entry.success, entry.assistantId ?? null, entry.errorMessage ?? null, entry.durationMs, entry.initiatedBy],
  );
}

export async function listVapiSyncLog(versionId: string): Promise<VapiSyncLogEntry[]> {
  const { rows } = await query<{
    id: string; action: 'create' | 'update'; success: boolean; assistant_id: string | null;
    error_message: string | null; duration_ms: number; initiated_by: string; created_at: Date;
  }>(
    `SELECT id, action, success, assistant_id, error_message, duration_ms, initiated_by, created_at
     FROM vapi_sync_log WHERE script_version_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [versionId],
  );
  return rows.map(r => ({
    id: r.id, action: r.action, success: r.success, assistantId: r.assistant_id,
    errorMessage: r.error_message, durationMs: r.duration_ms, initiatedBy: r.initiated_by, createdAt: new Date(r.created_at),
  }));
}

export interface SyncHealthRow {
  totalAttempts: number;
  successCount: number;
  failureCount: number;
}

/** Real sync-reliability metric for the Ops health page (Topic K/L) --
 * across ALL script versions, not just one, derived from the existing
 * vapi_sync_log trace table. */
export async function vapiSyncHealthLast7Days(): Promise<SyncHealthRow> {
  const { rows } = await query<{ total: string; success: string; failure: string }>(
    `SELECT COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE success = TRUE)::text AS success,
            COUNT(*) FILTER (WHERE success = FALSE)::text AS failure
       FROM vapi_sync_log WHERE created_at >= now() - interval '7 days'`
  );
  return { totalAttempts: Number(rows[0]?.total ?? 0), successCount: Number(rows[0]?.success ?? 0), failureCount: Number(rows[0]?.failure ?? 0) };
}

export interface PublishedVersionOption {
  versionId: string;
  scriptName: string;
  versionNumber: number;
}

export async function listPublishedVersions(): Promise<PublishedVersionOption[]> {
  const { rows } = await query<{ id: string; version_number: number; script_name: string }>(
    `SELECT csv.id, csv.version_number, cs.name AS script_name
       FROM call_script_version csv
       JOIN call_script cs ON cs.id = csv.script_id
      WHERE csv.status = 'published'
      ORDER BY cs.name`
  );
  return rows.map((r) => ({ versionId: r.id, scriptName: r.script_name, versionNumber: r.version_number }));
}

/** Published versions that ALSO already hold a synced vapi_assistant_id --
 * the only versions VapiCallAdapter.placeCall() can actually use. */
export async function listVapiSyncedVersions(): Promise<PublishedVersionOption[]> {
  const { rows } = await query<{ id: string; version_number: number; script_name: string }>(
    `SELECT csv.id, csv.version_number, cs.name AS script_name
       FROM call_script_version csv
       JOIN call_script cs ON cs.id = csv.script_id
      WHERE csv.status = 'published' AND csv.vapi_assistant_id IS NOT NULL
      ORDER BY cs.name`
  );
  return rows.map((r) => ({ versionId: r.id, scriptName: r.script_name, versionNumber: r.version_number }));
}

export async function countScripts(): Promise<number> {
  const { rows } = await query<{ count: string }>('SELECT COUNT(*)::text AS count FROM call_script');
  return Number(rows[0]?.count ?? 0);
}

export interface ScriptUsageRow {
  scriptId: string;
  scriptName: string;
  callCount: number;
}

export async function scriptUsageCounts(): Promise<ScriptUsageRow[]> {
  const { rows } = await query<{ script_id: string; script_name: string; call_count: string }>(
    `SELECT cs.id AS script_id, cs.name AS script_name, COUNT(cl.id)::text AS call_count
       FROM call_script cs
       LEFT JOIN call_script_version csv ON csv.script_id = cs.id
       LEFT JOIN call_log cl ON cl.script_version_id = csv.id
      GROUP BY cs.id, cs.name
      ORDER BY COUNT(cl.id) DESC`
  );
  return rows.map((r) => ({ scriptId: r.script_id, scriptName: r.script_name, callCount: Number(r.call_count) }));
}
