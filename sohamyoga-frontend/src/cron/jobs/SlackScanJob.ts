// SlackScanJob — Every 30 minutes
// Scans connected Slack channels for new/changed message history. Honest
// no-op until Slack is actually connected via /admin/ai-ingestion/auth.

import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { scanSlack } from '@/domain/ingestion/slackOps';

export async function run(): Promise<void> {
  const tenantId = await getPrimaryTenantId();
  try {
    const result = await scanSlack(tenantId);
    console.log(`[slack-scan] ${result.channelsDiscovered} channel(s) discovered, ${result.channelsNew} new, ${result.channelsChanged} changed`);
  } catch (err) {
    console.log(`[slack-scan] skipped — ${err instanceof Error ? err.message : err}`);
  }
}
