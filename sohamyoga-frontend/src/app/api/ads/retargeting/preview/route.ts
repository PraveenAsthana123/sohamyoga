import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real Retargeting Screen -- ad_audience (custom/lookalike types) already
// supported freeform segment_key/segment_value entry, but nothing tied it to
// this app's actual real visitor data (tracking_event/anonymous_id). This
// counts real distinct visitors to a given URL path in the trailing window
// before an admin saves it as a retargeting audience, so the reach number
// shown is a genuine live count, not a placeholder.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const urlPattern = req.nextUrl.searchParams.get('urlPattern')?.trim();
  const days = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get('days')) || 30));
  if (!urlPattern) return Response.json({ error: 'urlPattern is required.' }, { status: 400 });

  const result = await query<{ reach: string }>(
    `SELECT COUNT(DISTINCT anonymous_id) AS reach FROM tracking_event
     WHERE url ILIKE $1 AND created_at >= now() - ($2 || ' days')::interval`,
    [`%${urlPattern}%`, days],
  );
  return Response.json({ urlPattern, days, reach: Number(result.rows[0].reach) });
}
