import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real Local Search Conversion -- ties this app's own real tracking_session/
// tracking_event data to local-search-attributed traffic (Google Maps /
// Google Business Profile referrers or a local/gbp UTM source) and measures
// how many of those visitors went on to a real conversion event. No paid
// rank-tracking or attribution API involved -- purely first-party data
// already collected by this app's analytics pipeline. Reach may legitimately
// be zero if no such traffic has occurred yet; that is reported honestly,
// not padded.
const LOCAL_REFERRER_PATTERNS = ['google.com/maps', 'business.google.com', 'g.page'];
const LOCAL_UTM_SOURCES = ['gbp', 'google_business', 'google_maps', 'local'];
const CONVERSION_EVENT_TYPES = ['booking_completed', 'payment_completed', 'subscription_started'];

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const days = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get('days')) || 30));

  const sessions = await query<{ anonymous_id: string }>(
    `SELECT DISTINCT anonymous_id FROM tracking_session
     WHERE started_at >= now() - ($1 || ' days')::interval
       AND (referrer ILIKE ANY ($2) OR utm_source = ANY ($3))`,
    [days, LOCAL_REFERRER_PATTERNS.map(p => `%${p}%`), LOCAL_UTM_SOURCES],
  );
  const anonymousIds = sessions.rows.map(r => r.anonymous_id);

  let converted = 0;
  if (anonymousIds.length) {
    const conv = await query<{ count: string }>(
      `SELECT COUNT(DISTINCT anonymous_id) AS count FROM tracking_event
       WHERE anonymous_id = ANY ($1) AND event_type = ANY ($2)`,
      [anonymousIds, CONVERSION_EVENT_TYPES],
    );
    converted = Number(conv.rows[0].count);
  }

  return Response.json({
    days,
    localSearchVisitors: anonymousIds.length,
    converted,
    conversionRatePct: anonymousIds.length ? Math.round((converted / anonymousIds.length) * 10000) / 100 : 0,
  });
}
