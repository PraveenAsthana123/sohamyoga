// Orchestration for the local_folder connector — used by the manual "Scan now"
// API route and by LocalFolderScanJob (the real scheduled Automatic Process job).

import { createHash } from 'crypto';
import { query } from '@/lib/postgres';
import { LocalFolderAdapter } from './LocalFolderAdapter';

const CONNECTOR_KEY = 'local_folder';

function contentHash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

async function getConnectorId(tenantId: string): Promise<string> {
  const result = await query<{ id: string }>(
    `SELECT id FROM connector WHERE tenant_id = $1 AND connector_key = $2`, [tenantId, CONNECTOR_KEY],
  );
  if (!result.rows.length) throw new Error(`Connector "${CONNECTOR_KEY}" not found for tenant.`);
  return result.rows[0].id;
}

export interface ScanResult {
  discoveryRunId: string;
  filesDiscovered: number;
  filesNew: number;
  filesChanged: number;
}

export async function scanWatchedFolder(tenantId: string): Promise<ScanResult> {
  const folderPath = process.env.WATCHED_FOLDER_PATH;
  if (!folderPath) {
    throw new Error('WATCHED_FOLDER_PATH is not configured. Set it to a real local folder path to enable file ingestion.');
  }

  const connectorId = await getConnectorId(tenantId);
  const adapter = new LocalFolderAdapter(folderPath);

  const runResult = await query<{ id: string }>(
    `INSERT INTO discovery_run (tenant_id, connector_id, run_type, status)
     VALUES ($1, $2, 'scheduled_scan', 'running') RETURNING id`,
    [tenantId, connectorId],
  );
  const discoveryRunId = runResult.rows[0].id;

  try {
    const filePaths = await adapter.discover!();
    let filesNew = 0;
    let filesChanged = 0;

    for (const filePath of filePaths) {
      let envelope;
      try {
        envelope = await adapter.read(filePath);
      } catch (err) {
        // A single oversized/unreadable file must not abort the whole scan.
        console.warn(`[local-folder] skipping ${filePath}:`, err instanceof Error ? err.message : err);
        continue;
      }
      const hash = contentHash(envelope.items[0]?.text ?? '');

      const existing = await query<{ id: string }>(
        `SELECT id FROM source WHERE tenant_id = $1 AND connector_id = $2 AND external_id = $3`,
        [tenantId, connectorId, filePath],
      );

      if (!existing.rows.length) {
        const inserted = await query<{ id: string }>(
          `INSERT INTO source (tenant_id, connector_id, source_type, external_id, name, discovery_status, last_discovered_at, last_verified_at)
           VALUES ($1, $2, 'local_folder', $3, $4, 'active', now(), now()) RETURNING id`,
          [tenantId, connectorId, filePath, envelope.title],
        );
        await query(
          `INSERT INTO source_version (source_id, version_label, content_hash, changed_summary) VALUES ($1, 'V1', $2, $3)`,
          [inserted.rows[0].id, hash, JSON.stringify({ bytes: envelope.items[0]?.text.length ?? 0 })],
        );
        filesNew += 1;
        continue;
      }

      const sourceId = existing.rows[0].id;
      const latestVersion = await query<{ content_hash: string | null }>(
        `SELECT content_hash FROM source_version WHERE source_id = $1 ORDER BY recorded_at DESC LIMIT 1`, [sourceId],
      );
      if (latestVersion.rows[0]?.content_hash !== hash) {
        const countResult = await query<{ n: string }>(`SELECT COUNT(*) AS n FROM source_version WHERE source_id = $1`, [sourceId]);
        await query(
          `INSERT INTO source_version (source_id, version_label, content_hash, changed_summary) VALUES ($1, $2, $3, $4)`,
          [sourceId, `V${Number(countResult.rows[0].n) + 1}`, hash, JSON.stringify({ bytes: envelope.items[0]?.text.length ?? 0 })],
        );
        await query(`UPDATE source SET discovery_status = 'changed', last_discovered_at = now(), last_verified_at = now(), modified_at = now() WHERE id = $1`, [sourceId]);
        filesChanged += 1;
      } else {
        await query(`UPDATE source SET last_verified_at = now() WHERE id = $1`, [sourceId]);
      }
    }

    await query(
      `UPDATE discovery_run SET status = 'succeeded', sources_discovered = $2, sources_new = $3, sources_changed = $4, completed_at = now() WHERE id = $1`,
      [discoveryRunId, filePaths.length, filesNew, filesChanged],
    );
    await query(`UPDATE connector SET status = 'healthy', can_discover = TRUE, can_read = TRUE, last_successful_discovery_at = now() WHERE id = $1`, [connectorId]);

    return { discoveryRunId, filesDiscovered: filePaths.length, filesNew, filesChanged };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await query(`UPDATE discovery_run SET status = 'failed', error_message = $2, completed_at = now() WHERE id = $1`, [discoveryRunId, message]);
    await query(`UPDATE connector SET last_failure_at = now(), last_failure_message = $2 WHERE id = $1`, [connectorId, message]);
    throw err;
  }
}
