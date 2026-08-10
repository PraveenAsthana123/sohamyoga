// POST /api/social/setup — Save provider credentials to OpenBao.
// App Secret is written to OpenBao KV; App ID written to postiz_provider_status table.
// Neither value is logged. This endpoint requires admin auth (checked via session).

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

const OPENBAO_BASE  = process.env.OPENBAO_ADDR       ?? 'http://localhost:8200';
const OPENBAO_TOKEN = process.env.OPENBAO_ROOT_TOKEN ?? '';
const DATABASE_URL  = process.env.DATABASE_URL        ?? '';

const ALLOWED_PROVIDERS = new Set([
  'telegram', 'discord', 'bluesky', 'reddit', 'youtube', 'pinterest',
  'facebook', 'instagram', 'threads', 'linkedin', 'x', 'tiktok', 'mastodon',
]);

async function writeToOpenBao(provider: string, appId: string, appSecret: string): Promise<void> {
  const path = `v1/secret/data/sohamyoga-portal/${provider}`;
  const res = await fetch(`${OPENBAO_BASE}/${path}`, {
    method: 'POST',
    headers: {
      'X-Vault-Token': OPENBAO_TOKEN,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ data: { app_id: appId, app_secret: appSecret } }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenBao write failed: ${res.status} ${body}`);
  }
  // Do not log appId or appSecret
}

async function markConfigured(provider: string): Promise<void> {
  if (!DATABASE_URL) return;
  const { Pool } = await import('pg');
  const db = new Pool({ connectionString: DATABASE_URL });
  try {
    await db.query(`
      INSERT INTO postiz_provider_status (provider_name, is_configured, missing_vars, checked_at)
      VALUES ($1, true, '{}', NOW())
      ON CONFLICT (provider_name) DO UPDATE SET is_configured=true, missing_vars='{}', checked_at=NOW()
    `, [provider]);
  } finally {
    await db.end();
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const denied = await requireAdmin(req);
  if (denied) return denied as NextResponse;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { provider, appId, appSecret } = body as Record<string, string>;

  if (!provider || !ALLOWED_PROVIDERS.has(provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
  }
  if (!appId) {
    return NextResponse.json({ error: 'appId required' }, { status: 400 });
  }

  try {
    await writeToOpenBao(provider, appId, appSecret ?? '');
    await markConfigured(provider);
    return NextResponse.json({ ok: true, provider });
    // Note: appId and appSecret deliberately not echoed back
  } catch (err) {
    console.error('[social/setup] write failed for provider:', provider, (err as Error).message);
    return NextResponse.json({ error: 'Failed to save credentials' }, { status: 500 });
  }
}

// GET /api/social/setup — return which providers are configured (no secret values)
export async function GET(req: NextRequest): Promise<NextResponse> {
  const denied = await requireAdmin(req);
  if (denied) return denied as NextResponse;
  if (!DATABASE_URL) {
    return NextResponse.json({ providers: [] });
  }
  const { Pool } = await import('pg');
  const db = new Pool({ connectionString: DATABASE_URL });
  try {
    const res = await db.query<{
      provider_name: string; is_configured: boolean; review_required: boolean;
      missing_vars: string[]; checked_at: string;
    }>(
      `SELECT provider_name, is_configured, review_required, missing_vars, checked_at
       FROM postiz_provider_status ORDER BY provider_name`,
    );
    return NextResponse.json({ providers: res.rows });
  } catch {
    return NextResponse.json({ providers: [] });
  } finally {
    await db.end();
  }
}
