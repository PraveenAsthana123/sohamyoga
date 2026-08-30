import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /go/[slug] — the real CTA redirect + click-tracking service (Module 9's
// core ask). Public by design (visitors click these), not admin-gated.
// Increments click_count and logs a cta_click_event on every real hit, then
// redirects — using the fallback URL if the destination's last health check
// found it broken, so a visitor never lands on a known-dead link.
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const result = await query<{ id: string; destination_url: string; fallback_url: string | null; last_check_status: string; status: string }>(
    `SELECT id, destination_url, fallback_url, last_check_status::text, status::text FROM cta WHERE tracking_slug = $1`,
    [params.slug],
  );
  if (!result.rows.length) return Response.json({ error: 'Unknown CTA.' }, { status: 404 });
  const cta = result.rows[0];
  if (cta.status === 'archived' || cta.status === 'paused') return Response.json({ error: 'This CTA is not currently active.' }, { status: 410 });

  await query(`UPDATE cta SET click_count = click_count + 1 WHERE id = $1`, [cta.id]);
  await query(
    `INSERT INTO cta_click_event (cta_id, referrer, user_agent) VALUES ($1, $2, $3)`,
    [cta.id, req.headers.get('referer'), req.headers.get('user-agent')],
  );

  const target = cta.last_check_status === 'broken' && cta.fallback_url ? cta.fallback_url : cta.destination_url;
  return Response.redirect(target, 302);
}
