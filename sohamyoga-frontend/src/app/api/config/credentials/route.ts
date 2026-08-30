// POST /api/config/credentials — Write portal credentials to OpenBao.
// Passwords are transmitted over HTTPS, written to OpenBao KV, then discarded.
// NEVER stored in: database, .env, logs, or git.

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

const OPENBAO_BASE  = process.env.OPENBAO_ADDR       ?? 'http://localhost:8200';
const OPENBAO_TOKEN = process.env.OPENBAO_ROOT_TOKEN ?? '';

const ALLOWED_PORTALS = new Set([
  'facebook_biz', 'instagram_biz', 'linkedin_biz', 'x_twitter', 'youtube',
  'tiktok_biz', 'pinterest', 'reddit', 'discord', 'telegram',
  'fb_developers', 'google_cloud', 'x_developer', 'linkedin_dev', 'tiktok_dev', 'discord_dev',
  'postiz', 'mautic', 'matomo', 'n8n', 'activepieces', 'keycloak',
  'openai',
  'custom',
]);

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { portal, fields } = body as { portal: string; fields: Record<string, string> };

  if (!portal || !ALLOWED_PORTALS.has(portal)) {
    return NextResponse.json({ error: 'Invalid portal key' }, { status: 400 });
  }
  if (!fields || typeof fields !== 'object') {
    return NextResponse.json({ error: 'fields required' }, { status: 400 });
  }

  // Strip any accidentally included empty fields
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === 'string' && v.trim()) cleaned[k] = v.trim();
  }

  const openbaoPath = `v1/secret/data/sohamyoga-portal/portals/${portal}`;
  try {
    const res = await fetch(`${OPENBAO_BASE}/${openbaoPath}`, {
      method: 'POST',
      headers: {
        'X-Vault-Token': OPENBAO_TOKEN,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ data: cleaned }),
      signal: AbortSignal.timeout(5_000),
    });

    if (!res.ok) {
      const msg = await res.text();
      console.error('[credentials] OpenBao write failed for portal:', portal, res.status);
      // Do not log `msg` as it might echo back field values in some Vault error messages
      void msg;
      return NextResponse.json({ error: 'Vault write failed' }, { status: 502 });
    }

    // Log only that a save occurred — never log field keys that might hint at content
    console.log('[credentials] saved portal:', portal, 'at', new Date().toISOString());
    return NextResponse.json({ ok: true, portal });

  } catch (err) {
    console.error('[credentials] network error reaching OpenBao:', (err as Error).message);
    return NextResponse.json({ error: 'Could not reach OpenBao' }, { status: 503 });
  }
}

// GET /api/config/credentials — list which portals have saved credentials (names only, no values)
export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const res = await fetch(`${OPENBAO_BASE}/v1/secret/metadata/sohamyoga-portal/portals?list=true`, {
      headers: { 'X-Vault-Token': OPENBAO_TOKEN },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return NextResponse.json({ portals: [] });
    const data = await res.json() as { data?: { keys?: string[] } };
    return NextResponse.json({ portals: data.data?.keys ?? [] });
  } catch {
    return NextResponse.json({ portals: [] });
  }
}
