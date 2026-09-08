import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyGithubSignature } from '@/domain/mcp/webhookVerify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Real GitHub webhook receiver -- verifies X-Hub-Signature-256 per GitHub's
 * documented HMAC-SHA256 scheme. Fails closed if the secret isn't
 * configured or the signature doesn't match, same discipline as
 * voice-agent-platform's /api/webhooks/vapi. */
export async function POST(req: NextRequest) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: 'GITHUB_WEBHOOK_SECRET is not configured.' }, { status: 503 });
  }
  const rawBody = await req.text();
  const signatureValid = verifyGithubSignature(rawBody, req.headers.get('x-hub-signature-256'), secret);
  if (!signatureValid) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
  }

  const eventType = req.headers.get('x-github-event') ?? 'unknown';
  let payload: unknown = {};
  try { payload = JSON.parse(rawBody); } catch { /* store raw failure below */ }

  await query(
    'INSERT INTO external_webhook_event (platform, event_type, signature_valid, payload) VALUES ($1,$2,$3,$4)',
    ['github', eventType, true, JSON.stringify(payload)]
  );

  return NextResponse.json({ received: true, eventType });
}
