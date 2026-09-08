import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { getInboundDefaultAssistantId, setInboundDefaultAssistant } from '@/domain/call/InboundRouting';
import { VoiceProviderNotConfiguredError } from '@/domain/call/VoiceProviderAdapter';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;
  try {
    const assistantId = await getInboundDefaultAssistantId(auth.principal.email);
    return NextResponse.json({ assistantId });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not read inbound routing.' }, { status: 502 });
  }
}

/**
 * Changes LIVE production inbound call routing for the real shared phone
 * number -- every future real inbound caller reaches this assistant,
 * immediately. The caller (admin UI) must have already gotten explicit
 * human confirmation before hitting this endpoint -- no dry-run mode here
 * by design, matching /api/admin/calls/place.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  const assistantId = typeof body.assistantId === 'string' ? body.assistantId : '';
  if (!assistantId) return NextResponse.json({ error: 'assistantId is required.' }, { status: 400 });

  try {
    await setInboundDefaultAssistant(assistantId, auth.principal.email);
    return NextResponse.json({ ok: true, assistantId });
  } catch (err) {
    if (err instanceof VoiceProviderNotConfiguredError) return NextResponse.json({ error: err.message }, { status: 503 });
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not set inbound routing.' }, { status: 502 });
  }
}
