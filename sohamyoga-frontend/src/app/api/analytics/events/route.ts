import { NextRequest, NextResponse } from 'next/server';

// Mirror of SENSITIVE_KEY_FRAGMENTS — server-side defence-in-depth
const SENSITIVE = [
  'name', 'email', 'phone', 'password', 'card', 'cvv', 'health',
  'diagnosis', 'message', 'address', 'dob', 'ssn', 'payment',
];

function ensureMasked(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    out[k] = SENSITIVE.some(f => k.toLowerCase().includes(f)) ? '***' : v;
  }
  return out;
}

interface EventBody {
  eventType?: string;
  name?: string;
  url?: string;
  referrer?: string;
  anonymousId?: string;
  userId?: string;
  properties?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  let body: EventBody;
  try {
    body = (await req.json()) as EventBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON' }, { status: 400 });
  }

  if (!body.name || !body.url) {
    return NextResponse.json({ ok: false, error: 'name and url are required' }, { status: 400 });
  }

  // userId is never persisted by this route — only anonymousId flows through
  const safePayload = {
    eventType: body.eventType ?? 'custom',
    name: body.name,
    url: body.url,
    referrer: body.referrer,
    anonymousId: body.anonymousId,
    properties: ensureMasked(body.properties ?? {}),
  };

  if (process.env.NODE_ENV === 'development') {
    console.log('[analytics]', safePayload.eventType, safePayload.name, safePayload.url);
  }

  // TODO: forward to backend — POST ${process.env.BACKEND_API_URL}/api/analytics/events
  // Or pipe directly to PostHog server-side SDK: posthog.capture(safePayload)

  return NextResponse.json({ ok: true });
}
