import { NextRequest, NextResponse } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { ConsentRecord, type ConsentLevel } from '@/domain/analytics/ConsentRecord';
import { maskProperties } from '@/lib/analytics-masking';

// Conversion/reliability events are recorded regardless of analytics consent —
// they're needed for the booking/payment flow to function and be auditable,
// not for behavioural analytics. Everything else requires 'analytics'-level
// consent server-side, as defense-in-depth alongside the client-side gate in
// AnalyticsProvider.tsx (a modified/bypassed client should not be able to get
// analytics events persisted just by calling this endpoint directly).
const ESSENTIAL_EVENT_TYPES = new Set([
  'booking_started', 'booking_completed', 'payment_initiated', 'payment_completed',
  'subscription_started', 'error',
]);

async function currentConsent(anonymousId: string): Promise<{ level: ConsentLevel; canCollectAnalytics: boolean }> {
  const row = await query<{
    id: string; user_id: string | null; level: ConsentLevel; granted: boolean;
    granted_at: string | null; revoked_at: string | null; ip_hash: string; user_agent: string;
    created_at: string; updated_at: string;
  }>(
    `SELECT id, user_id, level, granted, granted_at, revoked_at, ip_hash, user_agent, created_at, updated_at
     FROM analytics_consent_record WHERE anonymous_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [anonymousId],
  );
  const r = row.rows[0];
  if (!r) return { level: 'none', canCollectAnalytics: false };

  const record = new ConsentRecord({
    id: r.id, anonymousId, userId: r.user_id ?? undefined, level: r.level, granted: r.granted,
    grantedAt: r.granted_at ? new Date(r.granted_at) : undefined,
    revokedAt: r.revoked_at ? new Date(r.revoked_at) : undefined,
    ipHash: r.ip_hash, userAgent: r.user_agent,
    createdAt: new Date(r.created_at), updatedAt: new Date(r.updated_at),
  });
  return { level: record.level, canCollectAnalytics: record.canCollectAnalytics() };
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EVENT_TYPES = new Set([
  'page_view', 'click', 'form_start', 'form_submit', 'download',
  'booking_started', 'booking_completed', 'payment_initiated', 'payment_completed',
  'subscription_started', 'error', 'scroll_depth', 'custom',
]);

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
    const consent = await currentConsent(body.anonymousId);

    const session = await query<{ id: string }>(
      `INSERT INTO tracking_session (anonymous_id, user_id, landing_url, referrer, page_count, event_count, consent_level)
       VALUES ($1, $2, $3, $4, 1, 1, $5)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [body.anonymousId, body.userId || null, body.url, body.referrer || null, consent.level],
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
        `INSERT INTO tracking_session (anonymous_id, user_id, landing_url, referrer, consent_level)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [body.anonymousId, body.userId || null, body.url, body.referrer || null, consent.level],
      );
      sessionId = created.rows[0].id;
    } else {
      await query(
        `UPDATE tracking_session SET last_seen_at = now(), page_count = page_count + 1,
           event_count = event_count + 1, exit_url = $2, consent_level = $3 WHERE id = $1`,
        [sessionId, body.url, consent.level],
      );
    }

    // Essential/conversion events are always recorded. Everything else needs
    // server-verified analytics consent — a client that never sent (or lied
    // about) consent gets its event stored for audit but marked 'dropped'
    // with no properties persisted, not silently discarded and not trusted blind.
    const essential = ESSENTIAL_EVENT_TYPES.has(eventType);
    const allowed = essential || consent.canCollectAnalytics;
    const status = allowed ? 'collected' : 'dropped';
    const properties = allowed ? maskProperties(body.properties ?? {}) : {};

    await query(
      `INSERT INTO tracking_event (session_id, anonymous_id, user_id, event_type, name, url, referrer, properties, status, consent_level)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [sessionId, body.anonymousId, body.userId || null, eventType, body.name, body.url,
        body.referrer || null, JSON.stringify(properties), status, consent.level],
    );

    return NextResponse.json({ ok: true, persisted: true, status });
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
