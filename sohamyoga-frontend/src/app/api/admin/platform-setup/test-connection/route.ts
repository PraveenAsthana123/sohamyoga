import { NextRequest } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';
import { vaultRead } from '@/lib/openbao';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real connection test -- a lightweight, real API call per platform (never
// a full post), so an admin can verify credentials actually work before
// relying on them. Only the 4 platforms with a real client implementation
// (first-wave-adapters.ts) are testable here; anything else would be a
// fabricated "success" with no real call behind it.
async function testDiscord(creds: Record<string, string>) {
  if (!creds.webhook_url) throw new Error('webhook_url is required');
  const res = await fetch(creds.webhook_url, { method: 'GET', signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Discord rejected the webhook (HTTP ${res.status}) -- check the URL`);
  const body = await res.json();
  return { detail: `Connected to channel "${body.channel_id ?? 'unknown'}" on webhook "${body.name ?? 'unnamed'}"` };
}

async function testTelegram(creds: Record<string, string>) {
  if (!creds.bot_token) throw new Error('bot_token is required');
  const res = await fetch(`https://api.telegram.org/bot${creds.bot_token}/getMe`, { signal: AbortSignal.timeout(8000) });
  const body = await res.json();
  if (!res.ok || !body.ok) throw new Error(body.description || `Telegram rejected the bot token (HTTP ${res.status})`);
  return { detail: `Connected as bot @${body.result.username}` };
}

async function testMastodon(creds: Record<string, string>) {
  if (!creds.instance_url || !creds.access_token) throw new Error('instance_url and access_token are required');
  const base = new URL(creds.instance_url);
  base.pathname = '/api/v1/accounts/verify_credentials';
  const res = await fetch(base, { headers: { authorization: `Bearer ${creds.access_token}` }, signal: AbortSignal.timeout(8000) });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `Mastodon rejected the token (HTTP ${res.status})`);
  return { detail: `Connected as @${body.username} on ${base.hostname}` };
}

async function testBluesky(creds: Record<string, string>) {
  if (!creds.identifier || !creds.app_password) throw new Error('identifier and app_password are required');
  const res = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: creds.identifier, password: creds.app_password }),
    signal: AbortSignal.timeout(8000),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || `Bluesky rejected the credentials (HTTP ${res.status})`);
  return { detail: `Connected as ${body.handle}` };
}

const TESTERS: Record<string, (creds: Record<string, string>) => Promise<{ detail: string }>> = {
  discord: testDiscord, telegram: testTelegram, mastodon: testMastodon, bluesky: testBluesky,
};

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { platformKey?: string } | null;
  if (!body?.platformKey) return Response.json({ error: 'platformKey is required.' }, { status: 400 });

  const stored = await query<{ credential_reference: string | null }>(
    `SELECT credential_reference FROM platform_setup WHERE platform_key=$1`, [body.platformKey],
  );
  if (!stored.rowCount) return Response.json({ error: 'Unknown platform.' }, { status: 404 });

  const tester = TESTERS[body.platformKey];
  if (!tester) {
    const reason = `No real connection test exists for ${body.platformKey}; only discord, telegram, mastodon, and bluesky currently have implemented adapters.`;
    await query(
      `UPDATE platform_setup SET last_connection_test_at=now(),last_connection_test_status='unsupported',
       last_connection_test_detail=$2,updated_at=now() WHERE platform_key=$1`, [body.platformKey, reason],
    );
    await query(
      `INSERT INTO platform_setup_event(platform_key,event_type,outcome,detail,actor_id)
       VALUES($1,'connection_test_unsupported','info',$2,$3)`, [body.platformKey, reason, principal!.id],
    );
    return Response.json({ ok: false, unsupported: true, reason });
  }

  if (!stored.rows[0].credential_reference) {
    return Response.json({ ok: false, reason: 'Save the required credentials securely before testing.' }, { status: 409 });
  }
  const credentials = await vaultRead<Record<string, string>>(stored.rows[0].credential_reference);
  if (!credentials) return Response.json({ ok: false, reason: 'Stored credentials could not be read from OpenBao.' }, { status: 502 });

  try {
    const result = await tester(credentials);
    await query(
      `UPDATE platform_setup SET status='verified',last_verified_at=now(),verified_by=$2,
       last_connection_test_at=now(),last_connection_test_status='passed',
       last_connection_test_detail=$3,last_error_at=NULL,last_error_message=NULL,updated_at=now()
       WHERE platform_key=$1`, [body.platformKey, principal!.id, result.detail],
    );
    await query(
      `INSERT INTO platform_setup_event(platform_key,event_type,outcome,detail,actor_id)
       VALUES($1,'connection_test_passed','success',$2,$3)`, [body.platformKey, result.detail, principal!.id],
    );
    return Response.json({ ok: true, ...result });
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Connection test failed.';
    await query(
      `UPDATE platform_setup SET last_connection_test_at=now(),last_connection_test_status='failed',
       last_connection_test_detail=$2,last_error_at=now(),last_error_message=$2,updated_at=now()
       WHERE platform_key=$1`, [body.platformKey, reason],
    );
    await query(
      `INSERT INTO platform_setup_event(platform_key,event_type,outcome,detail,actor_id)
       VALUES($1,'connection_test_failed','failure',$2,$3)`, [body.platformKey, reason, principal!.id],
    );
    return Response.json({ ok: false, reason });
  }
}
