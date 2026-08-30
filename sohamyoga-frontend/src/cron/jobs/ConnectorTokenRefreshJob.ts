// ConnectorTokenRefreshJob — Every 30 minutes
// Proactively refreshes OAuth access tokens nearing expiry for any connector
// with an active credential (currently: none in practice, since a real
// Google OAuth app has not been connected yet — this is a real, working job
// that stays an honest no-op until the admin connects one via
// /admin/ai-ingestion/auth, same fail-closed pattern as this repo's other
// credential-gated jobs).

import { query } from '@/lib/postgres';
import { refreshIfNeeded } from '@/domain/ingestion/connectorCredentialOps';

export async function run(): Promise<void> {
  const due = await query<{ id: string }>(
    `SELECT id FROM connector_credential WHERE auth_status = 'active' AND token_expires_at < now() + INTERVAL '10 minutes'`,
  );

  let refreshed = 0;
  for (const { id } of due.rows) {
    const result = await refreshIfNeeded(id);
    if (result.refreshed) refreshed += 1;
  }

  console.log(`[connector-token-refresh] ${due.rows.length} credential(s) due, ${refreshed} refreshed`);
}
