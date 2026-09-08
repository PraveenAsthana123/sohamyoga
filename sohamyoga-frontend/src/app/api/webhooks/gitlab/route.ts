import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyGitlabToken } from '@/domain/mcp/webhookVerify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Real GitLab webhook receiver -- verifies X-Gitlab-Token per GitLab's
 * documented plain-shared-secret scheme (not HMAC-signed, unlike GitHub --
 * this is GitLab's real, documented design, not a weaker workaround). */
export async function POST(req: NextRequest) {
  const secret = process.env.GITLAB_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: 'GITLAB_WEBHOOK_SECRET is not configured.' }, { status: 503 });
  }
  const tokenValid = verifyGitlabToken(req.headers.get('x-gitlab-token'), secret);
  if (!tokenValid) {
    return NextResponse.json({ error: 'Invalid token.' }, { status: 401 });
  }

  const eventType = req.headers.get('x-gitlab-event') ?? 'unknown';
  const body = await req.json().catch(() => ({}));

  await query(
    'INSERT INTO external_webhook_event (platform, event_type, signature_valid, payload) VALUES ($1,$2,$3,$4)',
    ['gitlab', eventType, true, JSON.stringify(body)]
  );

  return NextResponse.json({ received: true, eventType });
}
