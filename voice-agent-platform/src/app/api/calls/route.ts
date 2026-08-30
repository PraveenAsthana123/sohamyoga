import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { createManualCall, listCalls } from '@/domain/call/repository';
import { CallDirection, CallStatus } from '@/domain/call/CallLog';

const VALID_DIRECTIONS: CallDirection[] = ['inbound', 'outbound'];
const VALID_STATUSES: CallStatus[] = ['queued', 'in_progress', 'completed', 'failed', 'no_answer'];

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;

  const calls = await listCalls();
  return NextResponse.json(calls);
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  const direction = body.direction as CallDirection;
  const status = body.status as CallStatus;
  if (!VALID_DIRECTIONS.includes(direction)) {
    return NextResponse.json({ error: `direction must be one of: ${VALID_DIRECTIONS.join(', ')}` }, { status: 400 });
  }
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
  }

  const durationSeconds = typeof body.durationSeconds === 'number' ? body.durationSeconds : null;
  const startedAt = typeof body.startedAt === 'string' && body.startedAt ? new Date(body.startedAt) : null;
  const endedAt = typeof body.endedAt === 'string' && body.endedAt ? new Date(body.endedAt) : null;

  try {
    const call = await createManualCall({
      direction,
      status,
      contactId: typeof body.contactId === 'string' && body.contactId ? body.contactId : null,
      scriptVersionId: typeof body.scriptVersionId === 'string' && body.scriptVersionId ? body.scriptVersionId : null,
      durationSeconds,
      startedAt,
      endedAt,
      outcomeNotes: typeof body.outcomeNotes === 'string' ? body.outcomeNotes : null,
      provider: 'manual',
      createdBy: auth.principal.email,
    });
    return NextResponse.json(call.toJSON(), { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Invalid call log entry.' }, { status: 400 });
  }
}
