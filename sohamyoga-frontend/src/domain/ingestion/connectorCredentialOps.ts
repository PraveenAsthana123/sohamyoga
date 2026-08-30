// Orchestration for connector_credential rows — used by the admin credential
// form's API routes and by ConnectorTokenRefreshJob. Never returns secret
// values or vault:// reference strings to callers outside this file; only
// status/scope/timestamp fields.

import { query } from '@/lib/postgres';
import { vaultRead, vaultWrite } from '@/lib/openbao';
import { buildAuthUrl, exchangeCode, refreshAccessToken, GOOGLE_SCOPES } from './GoogleOAuthConnector';
import { buildSlackAuthUrl, exchangeSlackCode, SLACK_SCOPES } from './SlackOAuthConnector';

export type ActorType = 'HUMAN' | 'SYSTEM' | 'AI' | 'BROWSER_AGENT' | 'API';

// google_chat reuses the same OAuth grant as google_drive (see integration-spec.md),
// so it isn't listed here as an independently-connectable credential.
const SCOPES_BY_CONNECTOR: Record<string, string[]> = {
  google_drive: GOOGLE_SCOPES,
  slack: SLACK_SCOPES,
};

interface CredentialRow {
  id: string; tenant_id: string; connector_id: string; auth_status: string;
  client_id_reference: string | null; client_secret_reference: string | null;
  refresh_token_reference: string | null;
}

async function getOrCreateCredentialRow(tenantId: string, connectorId: string): Promise<CredentialRow> {
  const existing = await query<CredentialRow>(
    `SELECT id, tenant_id, connector_id, auth_status::text, client_id_reference, client_secret_reference, refresh_token_reference
     FROM connector_credential WHERE tenant_id = $1 AND connector_id = $2`,
    [tenantId, connectorId],
  );
  if (existing.rows.length) return existing.rows[0];

  const created = await query<CredentialRow>(
    `INSERT INTO connector_credential (tenant_id, connector_id)
     VALUES ($1, $2)
     RETURNING id, tenant_id, connector_id, auth_status::text, client_id_reference, client_secret_reference, refresh_token_reference`,
    [tenantId, connectorId],
  );
  return created.rows[0];
}

export async function saveClientCredentials(
  tenantId: string, connectorId: string, connectorKey: string,
  clientId: string, clientSecret: string, actorType: ActorType, actorId: string,
): Promise<void> {
  const row = await getOrCreateCredentialRow(tenantId, connectorId);

  const clientIdRef = await vaultWrite(`sohamyoga-portal/ingestion/${tenantId}/${connectorKey}/client`, {
    client_id: clientId, client_secret: clientSecret,
  });
  // Same secret write covers both fields (one KV object); store the same
  // reference in both columns so either can be read back independently.
  await query(
    `UPDATE connector_credential
     SET client_id_reference = $2, client_secret_reference = $2, auth_status = 'auth_requested',
         requested_scopes = $3, connected_by_type = $4, connected_by_id = $5, updated_at = now()
     WHERE id = $1`,
    [row.id, clientIdRef, SCOPES_BY_CONNECTOR[connectorKey] ?? [], actorType, actorId],
  );
}

export interface CredentialStatus {
  authStatus: string; requestedScopes: string[]; grantedScopes: string[];
  hasClientCredentials: boolean; tokenExpiresAt: string | null; lastRefreshedAt: string | null;
  lastFailureAt: string | null; lastFailureMessage: string | null;
}

export async function getCredentialStatus(tenantId: string, connectorId: string): Promise<CredentialStatus> {
  const result = await query<{
    auth_status: string; requested_scopes: string[]; granted_scopes: string[];
    client_id_reference: string | null; token_expires_at: string | null; last_refreshed_at: string | null;
    last_failure_at: string | null; last_failure_message: string | null;
  }>(
    `SELECT auth_status::text, requested_scopes, granted_scopes, client_id_reference,
            token_expires_at, last_refreshed_at, last_failure_at, last_failure_message
     FROM connector_credential WHERE tenant_id = $1 AND connector_id = $2`,
    [tenantId, connectorId],
  );
  if (!result.rows.length) {
    return { authStatus: 'not_configured', requestedScopes: [], grantedScopes: [], hasClientCredentials: false, tokenExpiresAt: null, lastRefreshedAt: null, lastFailureAt: null, lastFailureMessage: null };
  }
  const r = result.rows[0];
  return {
    authStatus: r.auth_status, requestedScopes: r.requested_scopes, grantedScopes: r.granted_scopes,
    hasClientCredentials: Boolean(r.client_id_reference),
    tokenExpiresAt: r.token_expires_at, lastRefreshedAt: r.last_refreshed_at,
    lastFailureAt: r.last_failure_at, lastFailureMessage: r.last_failure_message,
  };
}

export async function startOAuth(tenantId: string, connectorId: string, redirectUri: string): Promise<string> {
  const row = await getOrCreateCredentialRow(tenantId, connectorId);
  if (!row.client_id_reference) {
    throw new Error('No client credentials saved for this connector yet. Save a Client ID and Client Secret first.');
  }
  const secret = await vaultRead<{ client_id: string; client_secret: string }>(row.client_id_reference);
  if (!secret) throw new Error('Could not read saved client credentials from the vault — try saving them again.');

  return buildAuthUrl(secret.client_id, secret.client_secret, redirectUri);
}

export async function handleOAuthCallback(
  tenantId: string, connectorId: string, connectorKey: string, code: string, redirectUri: string,
  actorType: ActorType, actorId: string,
): Promise<void> {
  const row = await getOrCreateCredentialRow(tenantId, connectorId);
  if (!row.client_id_reference) throw new Error('No client credentials saved for this connector.');
  const secret = await vaultRead<{ client_id: string; client_secret: string }>(row.client_id_reference);
  if (!secret) throw new Error('Could not read saved client credentials from the vault.');

  try {
    const tokens = await exchangeCode(secret.client_id, secret.client_secret, redirectUri, code);
    const accessRef = await vaultWrite(`sohamyoga-portal/ingestion/${tenantId}/${connectorKey}/token`, {
      access_token: tokens.accessToken,
    });
    const refreshRef = tokens.refreshToken
      ? await vaultWrite(`sohamyoga-portal/ingestion/${tenantId}/${connectorKey}/refresh`, { refresh_token: tokens.refreshToken })
      : row.refresh_token_reference;

    await query(
      `UPDATE connector_credential
       SET auth_status = 'active', access_token_reference = $2, refresh_token_reference = $3,
           granted_scopes = $4, token_expires_at = $5, connected_by_type = $6, connected_by_id = $7, updated_at = now()
       WHERE id = $1`,
      [row.id, accessRef, refreshRef, tokens.grantedScopes, tokens.expiryDate ? new Date(tokens.expiryDate) : null, actorType, actorId],
    );
    await query(
      `UPDATE connector SET status = 'healthy', can_discover = TRUE, can_read = TRUE, last_successful_discovery_at = now()
       WHERE id = $1`,
      [connectorId],
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await query(
      `UPDATE connector_credential SET auth_status = 'refresh_failed', last_failure_at = now(), last_failure_message = $2, updated_at = now()
       WHERE id = $1`,
      [row.id, message],
    );
    throw err;
  }
}

export async function startSlackOAuth(tenantId: string, connectorId: string, redirectUri: string): Promise<string> {
  const row = await getOrCreateCredentialRow(tenantId, connectorId);
  if (!row.client_id_reference) {
    throw new Error('No client credentials saved for this connector yet. Save a Client ID and Client Secret first.');
  }
  const secret = await vaultRead<{ client_id: string; client_secret: string }>(row.client_id_reference);
  if (!secret) throw new Error('Could not read saved client credentials from the vault — try saving them again.');
  return buildSlackAuthUrl(secret.client_id, redirectUri);
}

// Slack classic bot tokens (oauth.v2.access) don't expire the same way OAuth
// refresh tokens do, so there's no refresh flow here — only the access token
// is stored. If Slack's token-rotation feature is enabled on the app, this
// will need a real refresh path added then, not preemptively now.
export async function handleSlackOAuthCallback(
  tenantId: string, connectorId: string, connectorKey: string, code: string, redirectUri: string,
  actorType: ActorType, actorId: string,
): Promise<void> {
  const row = await getOrCreateCredentialRow(tenantId, connectorId);
  if (!row.client_id_reference) throw new Error('No client credentials saved for this connector.');
  const secret = await vaultRead<{ client_id: string; client_secret: string }>(row.client_id_reference);
  if (!secret) throw new Error('Could not read saved client credentials from the vault.');

  try {
    const tokens = await exchangeSlackCode(secret.client_id, secret.client_secret, redirectUri, code);
    const accessRef = await vaultWrite(`sohamyoga-portal/ingestion/${tenantId}/${connectorKey}/token`, {
      access_token: tokens.botToken, team_id: tokens.teamId,
    });
    await query(
      `UPDATE connector_credential
       SET auth_status = 'active', access_token_reference = $2, granted_scopes = $3, connected_by_type = $4, connected_by_id = $5, updated_at = now()
       WHERE id = $1`,
      [row.id, accessRef, tokens.grantedScopes, actorType, actorId],
    );
    await query(`UPDATE connector SET status = 'healthy', can_discover = TRUE, can_read = TRUE, last_successful_discovery_at = now() WHERE id = $1`, [connectorId]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await query(
      `UPDATE connector_credential SET auth_status = 'refresh_failed', last_failure_at = now(), last_failure_message = $2, updated_at = now() WHERE id = $1`,
      [row.id, message],
    );
    throw err;
  }
}

export async function refreshIfNeeded(credentialId: string): Promise<{ refreshed: boolean }> {
  const result = await query<{
    id: string; tenant_id: string; connector_id: string; connector_key: string;
    client_id_reference: string; refresh_token_reference: string | null;
  }>(
    `SELECT cc.id, cc.tenant_id, cc.connector_id, c.connector_key, cc.client_id_reference, cc.refresh_token_reference
     FROM connector_credential cc JOIN connector c ON c.id = cc.connector_id
     WHERE cc.id = $1 AND cc.auth_status = 'active' AND cc.token_expires_at < now() + INTERVAL '10 minutes'`,
    [credentialId],
  );
  if (!result.rows.length) return { refreshed: false };
  const row = result.rows[0];
  if (!row.refresh_token_reference) return { refreshed: false };

  const clientSecret = await vaultRead<{ client_id: string; client_secret: string }>(row.client_id_reference);
  const refreshSecret = await vaultRead<{ refresh_token: string }>(row.refresh_token_reference);
  if (!clientSecret || !refreshSecret) return { refreshed: false };

  try {
    const tokens = await refreshAccessToken(clientSecret.client_id, clientSecret.client_secret, refreshSecret.refresh_token);
    const accessRef = await vaultWrite(`sohamyoga-portal/ingestion/${row.tenant_id}/${row.connector_key}/token`, {
      access_token: tokens.accessToken,
    });
    await query(
      `UPDATE connector_credential
       SET access_token_reference = $2, token_expires_at = $3, last_refreshed_at = now(), updated_at = now()
       WHERE id = $1`,
      [row.id, accessRef, tokens.expiryDate ? new Date(tokens.expiryDate) : null],
    );
    return { refreshed: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await query(
      `UPDATE connector_credential SET auth_status = 'refresh_failed', last_failure_at = now(), last_failure_message = $2, updated_at = now()
       WHERE id = $1`,
      [row.id, message],
    );
    return { refreshed: false };
  }
}
