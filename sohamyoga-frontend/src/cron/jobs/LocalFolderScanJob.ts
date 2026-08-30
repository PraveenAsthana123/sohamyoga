// LocalFolderScanJob — Every 15 minutes
// Scans WATCHED_FOLDER_PATH for new/changed .txt/.md files. Honest no-op
// (clear log message, not a crash) until an admin sets the env var to a real
// local folder path — same fail-closed convention as the OAuth connectors.

import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { scanWatchedFolder } from '@/domain/ingestion/localFolderOps';

export async function run(): Promise<void> {
  if (!process.env.WATCHED_FOLDER_PATH) {
    console.log('[local-folder-scan] WATCHED_FOLDER_PATH not configured — skipping (not yet automated).');
    return;
  }
  const tenantId = await getPrimaryTenantId();
  const result = await scanWatchedFolder(tenantId);
  console.log(`[local-folder-scan] ${result.filesDiscovered} file(s) discovered, ${result.filesNew} new, ${result.filesChanged} changed`);
}
