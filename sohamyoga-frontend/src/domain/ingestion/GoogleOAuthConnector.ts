// Real Google OAuth2 authorization-code-flow helper for the Google source
// family (Drive/Docs/Sheets connectors). Uses google-auth-library's
// OAuth2Client — the actual Drive/Docs/Sheets API calls come later (Phase 5,
// `googleapis`); this file only establishes and refreshes the auth grant.

import { OAuth2Client } from 'google-auth-library';

// Per Phase 2 spec's own example scope list.
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
];

export interface GoogleTokenResult {
  accessToken: string;
  refreshToken: string | null;
  expiryDate: number | null;
  grantedScopes: string[];
}

export function buildAuthUrl(clientId: string, clientSecret: string, redirectUri: string, scopes: string[] = GOOGLE_SCOPES): string {
  const client = new OAuth2Client(clientId, clientSecret, redirectUri);
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
  });
}

export async function exchangeCode(
  clientId: string, clientSecret: string, redirectUri: string, code: string,
): Promise<GoogleTokenResult> {
  const client = new OAuth2Client(clientId, clientSecret, redirectUri);
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token) throw new Error('Google did not return an access token.');
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiryDate: tokens.expiry_date ?? null,
    grantedScopes: (tokens.scope ?? '').split(' ').filter(Boolean),
  };
}

export async function refreshAccessToken(
  clientId: string, clientSecret: string, refreshToken: string,
): Promise<GoogleTokenResult> {
  const client = new OAuth2Client(clientId, clientSecret);
  client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await client.refreshAccessToken();
  if (!credentials.access_token) throw new Error('Google did not return a refreshed access token.');
  return {
    accessToken: credentials.access_token,
    refreshToken: credentials.refresh_token ?? refreshToken,
    expiryDate: credentials.expiry_date ?? null,
    grantedScopes: (credentials.scope ?? '').split(' ').filter(Boolean),
  };
}
