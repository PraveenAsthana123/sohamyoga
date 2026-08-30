// Credential + OAuth orchestration for the Google Business Review connection.
// Mirrors src/domain/ingestion/connectorCredentialOps.ts's proven pattern
// (vault-only secret storage, never returns raw values), scoped to the
// single-connection-per-tenant google_business_connection table instead of
// the generic ingestion connector registry.

import { query } from '@/lib/postgres';
import { vaultRead, vaultWrite } from '@/lib/openbao';
import { buildAuthUrl, exchangeCode, refreshAccessToken } from '@/domain/ingestion/GoogleOAuthConnector';

export const GOOGLE_BUSINESS_SCOPES = ['https://www.googleapis.com/auth/business.manage'];

interface ConnectionRow {
  id: string; tenant_id: string; auth_status: string;
  client_id_reference: string | null; refresh_token_reference: string | null;
}

async function getOrCreateConnection(tenantId: string): Promise<ConnectionRow> {
  const existing = await query<ConnectionRow>(
    `SELECT id, tenant_id, auth_status::text, client_id_reference, refresh_token_reference FROM google_business_connection WHERE tenant_id = $1`,
    [tenantId],
  );
  if (existing.rows.length) return existing.rows[0];
  const created = await query<ConnectionRow>(
    `INSERT INTO google_business_connection (tenant_id) VALUES ($1)
     RETURNING id, tenant_id, auth_status::text, client_id_reference, refresh_token_reference`,
    [tenantId],
  );
  return created.rows[0];
}

export async function saveClientCredentials(tenantId: string, clientId: string, clientSecret: string): Promise<void> {
  const row = await getOrCreateConnection(tenantId);
  const ref = await vaultWrite(`sohamyoga-portal/reputation/${tenantId}/google-business/client`, {
    client_id: clientId, client_secret: clientSecret,
  });
  await query(
    `UPDATE google_business_connection SET client_id_reference = $2, auth_status = 'auth_requested', updated_at = now() WHERE id = $1`,
    [row.id, ref],
  );
}

export async function startOAuth(tenantId: string, redirectUri: string): Promise<string> {
  const row = await getOrCreateConnection(tenantId);
  if (!row.client_id_reference) throw new Error('No client credentials saved yet. Save a Client ID and Client Secret first.');
  const secret = await vaultRead<{ client_id: string; client_secret: string }>(row.client_id_reference);
  if (!secret) throw new Error('Could not read saved client credentials from the vault — try saving them again.');
  return buildAuthUrl(secret.client_id, secret.client_secret, redirectUri, GOOGLE_BUSINESS_SCOPES);
}

export async function handleOAuthCallback(tenantId: string, code: string, redirectUri: string): Promise<void> {
  const row = await getOrCreateConnection(tenantId);
  if (!row.client_id_reference) throw new Error('No client credentials saved for this connection.');
  const secret = await vaultRead<{ client_id: string; client_secret: string }>(row.client_id_reference);
  if (!secret) throw new Error('Could not read saved client credentials from the vault.');

  const tokens = await exchangeCode(secret.client_id, secret.client_secret, redirectUri, code);
  const accessRef = await vaultWrite(`sohamyoga-portal/reputation/${tenantId}/google-business/access`, { access_token: tokens.accessToken });
  const refreshRef = tokens.refreshToken
    ? await vaultWrite(`sohamyoga-portal/reputation/${tenantId}/google-business/refresh`, { refresh_token: tokens.refreshToken })
    : row.refresh_token_reference;

  await query(
    `UPDATE google_business_connection
     SET access_token_reference = $2, refresh_token_reference = $3, granted_scopes = $4,
         auth_status = 'active', token_expires_at = $5, updated_at = now()
     WHERE id = $1`,
    [row.id, accessRef, refreshRef, tokens.grantedScopes, tokens.expiryDate ? new Date(tokens.expiryDate) : null],
  );
}

/** Returns a live access token, refreshing first if the vault-stored one is expired. Null if never connected. */
export async function getValidAccessToken(tenantId: string): Promise<string | null> {
  const row = await query<{ id: string; access_token_reference: string | null; refresh_token_reference: string | null; token_expires_at: string | null; auth_status: string }>(
    `SELECT id, access_token_reference, refresh_token_reference, token_expires_at, auth_status::text FROM google_business_connection WHERE tenant_id = $1`,
    [tenantId],
  );
  if (!row.rows.length || row.rows[0].auth_status !== 'active' || !row.rows[0].access_token_reference) return null;
  const r = row.rows[0];
  const accessTokenReference = r.access_token_reference!;

  const isExpired = r.token_expires_at && new Date(r.token_expires_at).getTime() < Date.now() + 60_000;
  if (!isExpired) {
    const access = await vaultRead<{ access_token: string }>(accessTokenReference);
    return access?.access_token ?? null;
  }
  if (!r.refresh_token_reference) return null;

  const clientRow = await query<{ client_id_reference: string }>(`SELECT client_id_reference FROM google_business_connection WHERE id = $1`, [r.id]);
  const clientSecret = await vaultRead<{ client_id: string; client_secret: string }>(clientRow.rows[0].client_id_reference);
  const refreshToken = await vaultRead<{ refresh_token: string }>(r.refresh_token_reference);
  if (!clientSecret || !refreshToken) return null;

  try {
    const refreshed = await refreshAccessToken(clientSecret.client_id, clientSecret.client_secret, refreshToken.refresh_token);
    const accessRef = await vaultWrite(`sohamyoga-portal/reputation/${tenantId}/google-business/access`, { access_token: refreshed.accessToken });
    await query(
      `UPDATE google_business_connection SET access_token_reference = $2, token_expires_at = $3, updated_at = now() WHERE id = $1`,
      [r.id, accessRef, refreshed.expiryDate ? new Date(refreshed.expiryDate) : null],
    );
    return refreshed.accessToken;
  } catch (err) {
    await query(
      `UPDATE google_business_connection SET auth_status = 'refresh_failed', last_failure_at = now(), last_failure_message = $2, updated_at = now() WHERE id = $1`,
      [r.id, err instanceof Error ? err.message : String(err)],
    );
    return null;
  }
}
