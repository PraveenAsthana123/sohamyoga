// Shared register/refresh logic for the chatgpt_shared_snapshot connector —
// used by the admin API routes (manual register + manual "re-check now") and
// by IngestionSourceRefreshJob (the real scheduled Automatic Process job).
// Kept in one place so registration and the scheduled re-check can't drift.

import { createHash } from 'crypto';
import { query } from '@/lib/postgres';
import { ChatGptShareAdapter } from './ChatGptShareConnector';

const CONNECTOR_KEY = 'chatgpt_shared_snapshot';
const adapter = new ChatGptShareAdapter();

function contentHash(messageCount: number, title: string | null): string {
  return createHash('sha256').update(`${title ?? ''}::${messageCount}`).digest('hex');
}

async function getConnectorId(tenantId: string): Promise<string> {
  const result = await query<{ id: string }>(
    `SELECT id FROM connector WHERE tenant_id = $1 AND connector_key = $2`,
    [tenantId, CONNECTOR_KEY],
  );
  if (!result.rows.length) {
    throw new Error(`Connector "${CONNECTOR_KEY}" not found for tenant — run GET /api/admin/ingestion/connectors first to seed the catalog.`);
  }
  return result.rows[0].id;
}

export interface RegisterResult {
  sourceId: string;
  discoveryRunId: string;
  messageCount: number;
  title: string | null;
}

export async function registerChatGptSource(tenantId: string, shareUrl: string): Promise<RegisterResult> {
  const connectorId = await getConnectorId(tenantId);

  const existing = await query<{ id: string }>(
    `SELECT id FROM source WHERE tenant_id = $1 AND connector_id = $2 AND external_id = $3`,
    [tenantId, connectorId, shareUrl],
  );
  if (existing.rows.length) {
    throw new Error('This share link is already registered as a source. Use the refresh action to re-check it.');
  }

  const runResult = await query<{ id: string }>(
    `INSERT INTO discovery_run (tenant_id, connector_id, run_type, status)
     VALUES ($1, $2, 'manual_import', 'running') RETURNING id`,
    [tenantId, connectorId],
  );
  const discoveryRunId = runResult.rows[0].id;

  try {
    const envelope = await adapter.read(shareUrl);
    const hash = contentHash(envelope.items.length, envelope.title);

    // Phase 7 exact-duplicate detection: the same underlying ChatGPT
    // conversation can be registered under a different share URL (a
    // re-shared link). Catch that before creating a confusing second source
    // for content that's already tracked.
    const conversationId = envelope.metadata?.conversationId as string | undefined;
    if (conversationId) {
      const dupe = await query<{ id: string; external_id: string }>(
        `SELECT id, external_id FROM source WHERE tenant_id = $1 AND connector_id = $2 AND metadata->>'conversationId' = $3`,
        [tenantId, connectorId, conversationId],
      );
      if (dupe.rows.length) {
        throw new Error(`This conversation is already registered as a source under a different link (${dupe.rows[0].external_id}). Use the refresh action on that source instead.`);
      }
    }

    const sourceResult = await query<{ id: string }>(
      `INSERT INTO source (tenant_id, connector_id, source_type, external_id, name, discovery_status, metadata, last_discovered_at, last_verified_at)
       VALUES ($1, $2, 'chatgpt_shared_snapshot', $3, $4, 'active', $5, now(), now())
       RETURNING id`,
      [
        tenantId, connectorId, shareUrl, envelope.title ?? shareUrl,
        JSON.stringify({ liveSync: false, snapshot: true, conversationId: conversationId ?? null }),
      ],
    );
    const sourceId = sourceResult.rows[0].id;

    await query(
      `INSERT INTO source_version (source_id, version_label, content_hash, changed_summary)
       VALUES ($1, 'V1', $2, $3)`,
      [sourceId, hash, JSON.stringify({ messageCount: envelope.items.length })],
    );

    await query(
      `UPDATE discovery_run SET status = 'succeeded', sources_discovered = 1, sources_new = 1, completed_at = now(), source_id = $2
       WHERE id = $1`,
      [discoveryRunId, sourceId],
    );
    await query(`UPDATE connector SET last_successful_discovery_at = now() WHERE id = $1`, [connectorId]);

    return { sourceId, discoveryRunId, messageCount: envelope.items.length, title: envelope.title };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await query(
      `UPDATE discovery_run SET status = 'failed', error_message = $2, completed_at = now() WHERE id = $1`,
      [discoveryRunId, message],
    );
    await query(`UPDATE connector SET last_failure_at = now(), last_failure_message = $2 WHERE id = $1`, [connectorId, message]);
    throw err;
  }
}

export interface RefreshResult {
  discoveryRunId: string;
  changed: boolean;
  status: 'active' | 'changed' | 'unavailable';
}

export async function refreshChatGptSource(sourceId: string): Promise<RefreshResult> {
  const sourceResult = await query<{ id: string; tenant_id: string; connector_id: string; external_id: string }>(
    `SELECT id, tenant_id, connector_id, external_id FROM source WHERE id = $1`,
    [sourceId],
  );
  if (!sourceResult.rows.length) throw new Error(`Source ${sourceId} not found`);
  const source = sourceResult.rows[0];

  const runResult = await query<{ id: string }>(
    `INSERT INTO discovery_run (tenant_id, connector_id, source_id, run_type, status)
     VALUES ($1, $2, $3, 'scheduled_scan', 'running') RETURNING id`,
    [source.tenant_id, source.connector_id, sourceId],
  );
  const discoveryRunId = runResult.rows[0].id;

  try {
    const envelope = await adapter.read(source.external_id);
    const newHash = contentHash(envelope.items.length, envelope.title);

    const latestVersion = await query<{ content_hash: string | null; version_label: string }>(
      `SELECT content_hash, version_label FROM source_version WHERE source_id = $1 ORDER BY recorded_at DESC LIMIT 1`,
      [sourceId],
    );
    const changed = latestVersion.rows[0]?.content_hash !== newHash;

    if (changed) {
      const prevLabel = latestVersion.rows[0]?.version_label ?? 'V0';
      const nextNum = Number(prevLabel.replace('V', '')) + 1;
      await query(
        `INSERT INTO source_version (source_id, version_label, content_hash, changed_summary)
         VALUES ($1, $2, $3, $4)`,
        [sourceId, `V${nextNum}`, newHash, JSON.stringify({ messageCount: envelope.items.length })],
      );
    }

    const status: RefreshResult['status'] = changed ? 'changed' : 'active';
    await query(
      `UPDATE source SET discovery_status = $2, last_discovered_at = now(), last_verified_at = now(), modified_at = now() WHERE id = $1`,
      [sourceId, status],
    );
    await query(
      `UPDATE discovery_run SET status = 'succeeded', sources_discovered = 1, sources_changed = $2, completed_at = now() WHERE id = $1`,
      [discoveryRunId, changed ? 1 : 0],
    );
    await query(`UPDATE connector SET last_successful_discovery_at = now() WHERE id = $1`, [source.connector_id]);

    return { discoveryRunId, changed, status };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await query(
      `UPDATE discovery_run SET status = 'failed', error_message = $2, completed_at = now() WHERE id = $1`,
      [discoveryRunId, message],
    );
    await query(`UPDATE source SET discovery_status = 'unavailable', last_verified_at = now() WHERE id = $1`, [sourceId]);
    await query(`UPDATE connector SET last_failure_at = now(), last_failure_message = $2 WHERE id = $1`, [source.connector_id, message]);
    return { discoveryRunId, changed: false, status: 'unavailable' };
  }
}
