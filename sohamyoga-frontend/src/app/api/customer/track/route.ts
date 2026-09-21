import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { databaseConfigured, getPool } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── Schema ────────────────────────────────────────────────────────────────────

const ENSURE_TABLES = `
  CREATE TABLE IF NOT EXISTS customer_click_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT,
    customer_id UUID,
    visitor_id TEXT,
    event_type TEXT NOT NULL,
    page_path TEXT,
    element_id TEXT,
    element_text TEXT,
    element_type TEXT,
    source TEXT,
    medium TEXT,
    campaign TEXT,
    referrer_url TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    utm_term TEXT,
    device_type TEXT,
    browser TEXT,
    country TEXT,
    city TEXT,
    ip_hash TEXT,
    metadata_json JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS social_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform TEXT NOT NULL,
    insight_type TEXT NOT NULL,
    external_id TEXT,
    author_name TEXT,
    author_handle TEXT,
    content TEXT,
    rating INT,
    sentiment TEXT,
    sentiment_score NUMERIC(4,3),
    language TEXT DEFAULT 'en',
    url TEXT,
    media_url TEXT,
    likes INT DEFAULT 0,
    replies INT DEFAULT 0,
    shares INT DEFAULT 0,
    is_responded BOOLEAN DEFAULT false,
    response_text TEXT,
    responded_at TIMESTAMPTZ,
    is_flagged BOOLEAN DEFAULT false,
    tags TEXT[],
    captured_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS insight_monitor_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name TEXT NOT NULL,
    platforms TEXT[] NOT NULL,
    keywords TEXT[],
    min_rating INT,
    alert_on TEXT[] DEFAULT ARRAY['negative', 'mention'],
    notify_email TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS affiliate_click_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_code TEXT NOT NULL,
    affiliate_name TEXT,
    landing_page TEXT,
    referrer_url TEXT,
    utm_source TEXT,
    device_type TEXT,
    country TEXT,
    converted BOOLEAN DEFAULT false,
    order_id UUID,
    commission_earned NUMERIC(10,2),
    clicked_at TIMESTAMPTZ DEFAULT NOW()
  );
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function detectDevice(ua: string): string {
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  if (/mobile|android|iphone/i.test(ua)) return 'mobile';
  return 'desktop';
}

function detectBrowser(ua: string): string {
  if (/edg\//i.test(ua)) return 'edge';
  if (/chrome/i.test(ua)) return 'chrome';
  if (/firefox/i.test(ua)) return 'firefox';
  if (/safari/i.test(ua)) return 'safari';
  if (/opera|opr/i.test(ua)) return 'opera';
  return 'other';
}

// ── POST — public tracking endpoint ──────────────────────────────────────────

export async function POST(req: NextRequest): Promise<Response> {
  try {
    if (!databaseConfigured()) return Response.json({ ok: true });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return Response.json({ ok: true });

    const {
      event_type, page_path, element_id, element_text, element_type,
      source, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      visitor_id, metadata,
    } = body as Record<string, unknown>;

    if (typeof event_type !== 'string' || !event_type.trim()) {
      return Response.json({ ok: true });
    }

    const pool = getPool();
    await pool.query(ENSURE_TABLES);

    const sessionId = req.cookies.get('session_id')?.value ?? null;
    const customerId = req.cookies.get('customer_id')?.value ?? null;

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      req.headers.get('x-real-ip') ??
      '0.0.0.0';
    const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 16);

    const ua = req.headers.get('user-agent') ?? '';
    const referrer = req.headers.get('referer') ?? null;
    const deviceType = detectDevice(ua);
    const browser = detectBrowser(ua);

    const derivedSource = typeof source === 'string' ? source
      : typeof utm_source === 'string' ? utm_source : 'direct';
    const derivedMedium = typeof utm_medium === 'string' ? utm_medium : null;

    await pool.query(
      `INSERT INTO customer_click_events (
        session_id, customer_id, visitor_id, event_type, page_path,
        element_id, element_text, element_type, source, medium, campaign,
        referrer_url, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
        device_type, browser, ip_hash, metadata_json
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
      [
        sessionId, customerId,
        typeof visitor_id === 'string' ? visitor_id : null,
        event_type.trim(),
        typeof page_path === 'string' ? page_path : null,
        typeof element_id === 'string' ? element_id : null,
        typeof element_text === 'string' ? element_text : null,
        typeof element_type === 'string' ? element_type : null,
        derivedSource, derivedMedium,
        typeof utm_campaign === 'string' ? utm_campaign : null,
        referrer,
        typeof utm_source === 'string' ? utm_source : null,
        typeof utm_medium === 'string' ? utm_medium : null,
        typeof utm_campaign === 'string' ? utm_campaign : null,
        typeof utm_content === 'string' ? utm_content : null,
        typeof utm_term === 'string' ? utm_term : null,
        deviceType, browser, ipHash,
        metadata != null ? JSON.stringify(metadata) : '{}',
      ],
    ).catch(() => {}); // fire-and-forget — never fail a page load

    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: true }); // never crash on tracking failure
  }
}

// ── GET — admin view of events ────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  try {
    const pool = getPool();
    await pool.query(ENSURE_TABLES);

    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10), 500);
    const eventType = url.searchParams.get('event_type');
    const pagePath = url.searchParams.get('page_path');

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (eventType) { params.push(eventType); conditions.push(`event_type = $${params.length}`); }
    if (pagePath) { params.push(pagePath); conditions.push(`page_path = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit);

    const { rows } = await pool.query(
      `SELECT * FROM customer_click_events ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
      params,
    );

    return Response.json({ events: rows, total: rows.length });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
