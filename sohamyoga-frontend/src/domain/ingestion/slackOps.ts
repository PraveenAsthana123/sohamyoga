// Orchestration for the slack connector — mirrors googleDriveOps.ts's shape.

import { createHash } from 'crypto';
import { query } from '@/lib/postgres';
import { vaultRead } from '@/lib/openbao';
import { SlackAdapter } from './SlackAdapter';

const CONNECTOR_KEY = 'slack';

function contentHash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

async function getActiveBotToken(tenantId: string, connectorId: string): Promise<string> {
  const cred = await query<{ auth_status: string; access_token_reference: string | null }>(
    `SELECT auth_status::text, access_token_reference FROM connector_credential WHERE tenant_id = $1 AND connector_id = $2`,
    [tenantId, connectorId],
  );
  if (!cred.rows.length || cred.rows[0].auth_status !== 'active' || !cred.rows[0].access_token_reference) {
    throw new Error('Slack is not connected yet. Connect it via /admin/ai-ingestion/auth first.');
  }
  const secret = await vaultRead<{ access_token: string }>(cred.rows[0].access_token_reference);
  if (!secret) throw new Error('Could not read the stored Slack bot token from the vault.');
  return secret.access_token;
}

export interface SlackScanResult {
  discoveryRunId: string;
  channelsDiscovered: number;
  channelsNew: number;
  channelsChanged: number;
}

export async function scanSlack(tenantId: string): Promise<SlackScanResult> {
  const connectorResult = await query<{ id: string }>(
    `SELECT id FROM connector WHERE tenant_id = $1 AND connector_key = $2`, [tenantId, CONNECTOR_KEY],
  );
  if (!connectorResult.rows.length) throw new Error(`Connector "${CONNECTOR_KEY}" not found for tenant.`);
  const connectorId = connectorResult.rows[0].id;

  const botToken = await getActiveBotToken(tenantId, connectorId);
  const adapter = new SlackAdapter(botToken);

  const runResult = await query<{ id: string }>(
    `INSERT INTO discovery_run (tenant_id, connector_id, run_type, status) VALUES ($1, $2, 'scheduled_scan', 'running') RETURNING id`,
    [tenantId, connectorId],
  );
  const discoveryRunId = runResult.rows[0].id;

  try {
    const channelIds = await adapter.discover!();
    let channelsNew = 0;
    let channelsChanged = 0;

    for (const channelId of channelIds) {
      let envelope;
      try {
        envelope = await adapter.read(channelId);
      } catch (err) {
        console.warn(`[slack] skipping ${channelId}:`, err instanceof Error ? err.message : err);
        continue;
      }
      const hash = contentHash(envelope.items.map(i => i.text).join('\n'));

      const existing = await query<{ id: string }>(
        `SELECT id FROM source WHERE tenant_id = $1 AND connector_id = $2 AND external_id = $3`,
        [tenantId, connectorId, channelId],
      );

      if (!existing.rows.length) {
        const inserted = await query<{ id: string }>(
          `INSERT INTO source (tenant_id, connector_id, source_type, external_id, name, discovery_status, metadata, last_discovered_at, last_verified_at)
           VALUES ($1, $2, 'slack_channel', $3, $4, 'active', $5, now(), now()) RETURNING id`,
          [tenantId, connectorId, channelId, envelope.title, JSON.stringify({ messageCount: envelope.items.length })],
        );
        await query(`INSERT INTO source_version (source_id, version_label, content_hash) VALUES ($1, 'V1', $2)`, [inserted.rows[0].id, hash]);
        channelsNew += 1;
        continue;
      }

      const sourceId = existing.rows[0].id;
      const latestVersion = await query<{ content_hash: string | null }>(
        `SELECT content_hash FROM source_version WHERE source_id = $1 ORDER BY recorded_at DESC LIMIT 1`, [sourceId],
      );
      if (latestVersion.rows[0]?.content_hash !== hash) {
        const countResult = await query<{ n: string }>(`SELECT COUNT(*) AS n FROM source_version WHERE source_id = $1`, [sourceId]);
        await query(`INSERT INTO source_version (source_id, version_label, content_hash) VALUES ($1, $2, $3)`, [sourceId, `V${Number(countResult.rows[0].n) + 1}`, hash]);
        await query(`UPDATE source SET discovery_status = 'changed', last_discovered_at = now(), last_verified_at = now(), modified_at = now(), metadata = $2 WHERE id = $1`, [sourceId, JSON.stringify({ messageCount: envelope.items.length })]);
        channelsChanged += 1;
      } else {
        await query(`UPDATE source SET last_verified_at = now() WHERE id = $1`, [sourceId]);
      }
    }

    await query(
      `UPDATE discovery_run SET status = 'succeeded', sources_discovered = $2, sources_new = $3, sources_changed = $4, completed_at = now() WHERE id = $1`,
      [discoveryRunId, channelIds.length, channelsNew, channelsChanged],
    );
    await query(`UPDATE connector SET last_successful_discovery_at = now() WHERE id = $1`, [connectorId]);

    return { discoveryRunId, channelsDiscovered: channelIds.length, channelsNew, channelsChanged };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await query(`UPDATE discovery_run SET status = 'failed', error_message = $2, completed_at = now() WHERE id = $1`, [discoveryRunId, message]);
    throw err;
  }
}
