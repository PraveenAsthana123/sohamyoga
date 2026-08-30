import { query, pool } from '@/lib/db';
import { CallScript, CallScriptProps, ClinicServiceType } from './CallScript';
import { CallScriptVersion, CallScriptVersionProps, CallScriptSections, CallScriptVersionStatus } from './CallScriptVersion';

interface ScriptRow {
  id: string;
  slug: string;
  name: string;
  service_type: ClinicServiceType;
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
}

function scriptToEntity(row: ScriptRow): CallScript {
  const props: CallScriptProps = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    serviceType: row.service_type,
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

export interface CreateScriptInput {
  slug: string;
  name: string;
  serviceType: ClinicServiceType;
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
      `INSERT INTO call_script (slug, name, service_type) VALUES ($1, $2, $3) RETURNING *`,
      [input.slug, input.name, input.serviceType]
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
