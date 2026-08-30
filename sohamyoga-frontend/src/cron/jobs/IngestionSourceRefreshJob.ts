// IngestionSourceRefreshJob — Every 6 hours
// Re-checks every registered chatgpt_shared_snapshot source: re-fetches the
// share link, compares its content hash to the latest source_version, and
// records a new version + discovery_run when the snapshot has changed
// (e.g. the user re-shared after adding more prompts). This is the one real
// "Automatic Process" job behind Phase 1's Source Registry — every other
// source family stays honestly not_configured until a later phase adds auth.

import { query } from '@/lib/postgres';
import { refreshChatGptSource } from '@/domain/ingestion/chatGptSourceOps';

export async function run(): Promise<void> {
  const sources = await query<{ id: string }>(
    `SELECT s.id FROM source s
     JOIN connector c ON c.id = s.connector_id
     WHERE c.connector_key = 'chatgpt_shared_snapshot' AND s.discovery_status <> 'archived'`,
  );

  let refreshed = 0;
  let changed = 0;
  let failed = 0;

  for (const { id } of sources.rows) {
    try {
      const result = await refreshChatGptSource(id);
      refreshed += 1;
      if (result.changed) changed += 1;
      if (result.status === 'unavailable') failed += 1;
    } catch {
      failed += 1;
    }
  }

  console.log(`[ingestion-source-refresh] checked ${refreshed} source(s), ${changed} changed, ${failed} failed`);
}
