import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyPatreonSignature } from '@/domain/mcp/webhookVerify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Real Patreon webhook receiver -- verifies X-Patreon-Signature per
 * Patreon's documented HMAC-MD5 scheme. */
export async function POST(req: NextRequest) {
  const secret = process.env.PATREON_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: 'PATREON_WEBHOOK_SECRET is not configured.' }, { status: 503 });
  }
  const rawBody = await req.text();
  const signatureValid = verifyPatreonSignature(rawBody, req.headers.get('x-patreon-signature'), secret);
  if (!signatureValid) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
  }

  const eventType = req.headers.get('x-patreon-event') ?? 'unknown';
  let payload: unknown = {};
  try { payload = JSON.parse(rawBody); } catch { /* store raw failure below */ }

  await query(
    'INSERT INTO external_webhook_event (platform, event_type, signature_valid, payload) VALUES ($1,$2,$3,$4)',
    ['patreon', eventType, true, JSON.stringify(payload)]
  );

  return NextResponse.json({ received: true, eventType });
}
