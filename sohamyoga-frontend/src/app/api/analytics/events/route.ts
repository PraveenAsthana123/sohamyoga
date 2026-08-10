import { NextRequest, NextResponse } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Mirror of SENSITIVE_KEY_FRAGMENTS — server-side defence-in-depth
const SENSITIVE = [
  'name', 'email', 'phone', 'password', 'card', 'cvv', 'health',
  'diagnosis', 'message', 'address', 'dob', 'ssn', 'payment',
];

const EVENT_TYPES = new Set([
  'page_view', 'click', 'form_start', 'form_submit', 'download',
  'booking_started', 'booking_completed', 'payment_initiated', 'payment_completed',
  'subscription_started', 'error', 'scroll_depth', 'custom',
]);

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

// POST /api/analytics/events — public ingestion endpoint (called from the browser).
// No auth: this is how anonymous visitor events get recorded in the first place.
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
  if (!body.anonymousId) {
    return NextResponse.json({ ok: false, error: 'anonymousId is required' }, { status: 400 });
  }
  const eventType = EVENT_TYPES.has(body.eventType ?? '') ? body.eventType! : 'custom';

  if (!databaseConfigured()) {
    // No DB configured (e.g. local static export) — accept and drop, don't error the client.
    return NextResponse.json({ ok: true, persisted: false });
  }

  try {
    const session = await query<{ id: string }>(
      `INSERT INTO tracking_session (anonymous_id, user_id, landing_url, referrer, page_count, event_count)
       VALUES ($1, $2, $3, $4, 1, 1)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [body.anonymousId, body.userId || null, body.url, body.referrer || null],
    );

    let sessionId = session.rows[0]?.id;
    if (!sessionId) {
      const existing = await query<{ id: string }>(
        `SELECT id FROM tracking_session WHERE anonymous_id = $1 AND status != 'ended'
         ORDER BY started_at DESC LIMIT 1`,
        [body.anonymousId],
      );
      sessionId = existing.rows[0]?.id;
    }
    if (!sessionId) {
      // Genuinely no open session row (e.g. concurrent-insert race) — create one plainly.
      const created = await query<{ id: string }>(
        `INSERT INTO tracking_session (anonymous_id, user_id, landing_url, referrer)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [body.anonymousId, body.userId || null, body.url, body.referrer || null],
      );
      sessionId = created.rows[0].id;
    } else {
      await query(
        `UPDATE tracking_session SET last_seen_at = now(), page_count = page_count + 1,
           event_count = event_count + 1, exit_url = $2 WHERE id = $1`,
        [sessionId, body.url],
      );
    }

    await query(
      `INSERT INTO tracking_event (session_id, anonymous_id, user_id, event_type, name, url, referrer, properties, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'collected')`,
      [sessionId, body.anonymousId, body.userId || null, eventType, body.name, body.url,
        body.referrer || null, JSON.stringify(ensureMasked(body.properties ?? {}))],
    );

    return NextResponse.json({ ok: true, persisted: true });
  } catch (error) {
    console.error('[analytics/events] write failed:', error instanceof Error ? error.message : error);
    // Never break the visitor's page over an analytics write failure.
    return NextResponse.json({ ok: true, persisted: false });
  }
}

// GET /api/analytics/events — admin listing for the Events tab.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const type = req.nextUrl.searchParams.get('type');
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 100, 500);

  const rows = type && EVENT_TYPES.has(type)
    ? await query(
        `SELECT id, event_type, name, url, anonymous_id, status, created_at
         FROM tracking_event WHERE event_type = $1 ORDER BY created_at DESC LIMIT $2`,
        [type, limit],
      )
    : await query(
        `SELECT id, event_type, name, url, anonymous_id, status, created_at
         FROM tracking_event ORDER BY created_at DESC LIMIT $1`,
        [limit],
      );

  return Response.json({ events: rows.rows });
}
