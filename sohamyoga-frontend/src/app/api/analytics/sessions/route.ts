// GET /api/analytics/sessions — recent anonymised sessions for the Sessions tab.

import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 50, 200);
  const rows = await query<{
    id: string; anonymous_id: string; device_type: string; browser: string | null; country: string | null;
    page_count: number; started_at: string; ended_at: string | null; last_seen_at: string;
    traffic_source: string | null; replay_available: boolean;
  }>(
    `SELECT id, anonymous_id, device_type::text, browser, country, page_count,
            started_at, ended_at, last_seen_at, traffic_source::text, replay_available
     FROM tracking_session ORDER BY started_at DESC LIMIT $1`,
    [limit],
  );

  return Response.json({
    sessions: rows.rows.map(r => {
      const endedAt = r.ended_at ? new Date(r.ended_at) : new Date(r.last_seen_at);
      const durationSec = Math.max(0, Math.round((endedAt.getTime() - new Date(r.started_at).getTime()) / 1000));
      return {
        id: r.id,
        anon: r.anonymous_id,
        device: r.device_type,
        browser: r.browser ?? 'unknown',
        country: r.country ?? '—',
        pages: r.page_count,
        durationLabel: `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`,
        source: r.traffic_source ?? 'direct',
        replay: r.replay_available,
      };
    }),
  });
}
