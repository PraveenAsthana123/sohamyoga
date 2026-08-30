// Phase 6 — Slack OAuth (real, scoped-down slice). No official Slack SDK
// needed for this — Slack's OAuth v2 is a plain authorization-code flow over
// two documented REST endpoints, same shape as Google's but with a
// same-request bot-token grant (no separate refresh step for classic bot
// tokens, so no refresh flow is implemented here — see integration-spec.md).

export const SLACK_SCOPES = ['channels:read', 'channels:history', 'groups:read', 'groups:history'];

export function buildSlackAuthUrl(clientId: string, redirectUri: string): string {
  const url = new URL('https://slack.com/oauth/v2/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('scope', SLACK_SCOPES.join(','));
  url.searchParams.set('redirect_uri', redirectUri);
  return url.toString();
}

export interface SlackTokenResult {
  botToken: string;
  teamId: string;
  grantedScopes: string[];
}

export async function exchangeSlackCode(clientId: string, clientSecret: string, redirectUri: string, code: string): Promise<SlackTokenResult> {
  const res = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
  });
  const body = await res.json() as { ok: boolean; error?: string; access_token?: string; team?: { id: string }; scope?: string };
  if (!body.ok || !body.access_token) {
    throw new Error(`Slack OAuth exchange failed: ${body.error ?? 'unknown error'}`);
  }
  return { botToken: body.access_token, teamId: body.team?.id ?? '', grantedScopes: (body.scope ?? '').split(',').filter(Boolean) };
}
