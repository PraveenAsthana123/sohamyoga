import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /utm/[id] -- the real click-tracking hop for a UTM link built at
 * /admin/utm-tracking. Public by design (this is what the tagged link
 * actually points to once shared), not admin-gated. Same shape as this
 * repo's other two public click-tracking redirects, /go/[slug] (cta) and
 * /r/[code] (referral_code): increments the row's click_count on every
 * real hit, then redirects to the destination -- which already carries the
 * utm_source/medium/campaign/content/term query params, so Matomo/PostHog
 * on the landing page pick them up exactly as before. This is what makes
 * utm_link.click_count (previously written by nothing, read only by
 * AnalyticsAggregationJob's SUM) an actually-exercised column instead of a
 * permanent zero.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!databaseConfigured()) return Response.redirect(new URL('/', req.url), 302);

  const result = await query<{ full_url: string }>(`SELECT full_url FROM utm_link WHERE id = $1`, [id]);
  if (!result.rowCount) return Response.json({ error: 'Unknown tracking link.' }, { status: 404 });

  await query(`UPDATE utm_link SET click_count = click_count + 1 WHERE id = $1`, [id]);

  return Response.redirect(new URL(result.rows[0].full_url, req.url), 302);
}
