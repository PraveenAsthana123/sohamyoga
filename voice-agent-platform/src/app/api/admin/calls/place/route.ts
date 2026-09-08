import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { getContact } from '@/domain/contact/repository';
import { getVersion } from '@/domain/script/repository';
import { getVoiceProviderAdapter } from '@/domain/call/getVoiceProviderAdapter';
import { VoiceProviderNotConfiguredError } from '@/domain/call/VoiceProviderAdapter';
import { createManualCall } from '@/domain/call/repository';
import { isRateLimited, clientIp } from '@/lib/rate-limit';

/**
 * Places a REAL outbound phone call via the configured VoiceProviderAdapter
 * (Vapi as of this build) and records the result as a call_log row. This
 * has a real-world side effect -- it rings a real phone -- so the caller
 * (the admin UI) must have already confirmed the destination with a human
 * before hitting this endpoint. There is no dry-run mode here by design:
 * a fake "would have called" response would violate this project's rule
 * against fabricating outcomes.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;

  // 2026-09-08 audit fix (SEC-06): real outbound calls cost real money and
  // had zero rate limiting beyond admin auth. 10 calls/min per IP is a
  // deliberately generous cap for legitimate admin use, tight enough to
  // stop a compromised admin session or a client bug from placing a burst
  // of real calls unnoticed.
  if (isRateLimited(`calls-place:${clientIp(req)}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many call placement requests. Try again shortly.' }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  const contactId = typeof body.contactId === 'string' ? body.contactId : '';
  const scriptVersionId = typeof body.scriptVersionId === 'string' ? body.scriptVersionId : '';
  if (!contactId || !scriptVersionId) {
    return NextResponse.json({ error: 'contactId and scriptVersionId are required.' }, { status: 400 });
  }

  const contact = await getContact(contactId);
  if (!contact) return NextResponse.json({ error: `Contact ${contactId} not found.` }, { status: 404 });
  if (!contact.phone) return NextResponse.json({ error: 'This contact has no phone number on file.' }, { status: 400 });
  if (!contact.isCallable) {
    return NextResponse.json({ error: `Contact status is '${contact.status}' -- not callable.` }, { status: 400 });
  }

  const version = await getVersion(scriptVersionId);
  if (!version) return NextResponse.json({ error: `Script version ${scriptVersionId} not found.` }, { status: 404 });

  const adapter = getVoiceProviderAdapter();

  try {
    const result = await adapter.placeCall({
      contactId,
      contactPhone: contact.phone,
      scriptVersionId,
      direction: 'outbound',
      initiatedBy: auth.principal.email,
    });

    const call = await createManualCall({
      direction: 'outbound',
      contactId,
      scriptVersionId,
      status: 'queued',
      provider: adapter.providerKey,
      createdBy: auth.principal.email,
      externalCallId: result.externalCallId,
    });

    return NextResponse.json({ call: call.toJSON(), providerStatus: result.providerStatus }, { status: 201 });
  } catch (err) {
    if (err instanceof VoiceProviderNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to place call.' }, { status: 502 });
  }
}
