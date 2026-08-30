// GoogleDriveScanJob — Every 30 minutes
// Scans connected Google Drive for new/changed Docs & Sheets. Honest no-op
// (clear log message) until Google Drive is actually connected via
// /admin/ai-ingestion/auth — real code, credential-gated same as every other
// OAuth-dependent job in this pipeline.

import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { scanGoogleDrive } from '@/domain/ingestion/googleDriveOps';

export async function run(): Promise<void> {
  const tenantId = await getPrimaryTenantId();
  try {
    const result = await scanGoogleDrive(tenantId);
    console.log(`[google-drive-scan] ${result.filesDiscovered} file(s) discovered, ${result.filesNew} new, ${result.filesChanged} changed`);
  } catch (err) {
    console.log(`[google-drive-scan] skipped — ${err instanceof Error ? err.message : err}`);
  }
}
