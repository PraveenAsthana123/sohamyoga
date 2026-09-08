import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real Viral Lead Detection -- correlates a viral_signal spike against real
// campaign_lead rows created in the same window on a matching platform.
// There is no post-level click-through link from viral_signal to
// campaign_lead (utm_link ties to campaign_brief, not to an individual
// social_post), so this is an honest time+platform correlation, not exact
// per-click attribution -- labeled as such in the response and UI.
export async function GET(req: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { postId } = await params;
  const signal = await query<{ platform: string; computed_at: string; window_hours: string; is_viral: boolean }>(
    `SELECT platform, computed_at, window_hours, is_viral FROM viral_signal WHERE post_id = $1 ORDER BY computed_at DESC LIMIT 1`,
    [postId],
  );
  if (!signal.rowCount) return Response.json({ error: 'No viral signal found for this post.' }, { status: 404 });
  const s = signal.rows[0];

  const leads = await query<{ id: string; email: string | null; source_platform: string | null; created_at: string; funnel_stage: string }>(
    `SELECT id, email, source_platform, created_at, funnel_stage FROM campaign_lead
     WHERE source_platform ILIKE $1
       AND created_at BETWEEN $2::timestamptz - ($3 || ' hours')::interval
                          AND $2::timestamptz + ($3 || ' hours')::interval
     ORDER BY created_at DESC`,
    [`%${s.platform}%`, s.computed_at, s.window_hours],
  );

  return Response.json({
    postId, platform: s.platform, isViral: s.is_viral, windowHours: Number(s.window_hours),
    correlatedLeadCount: leads.rowCount,
    leads: leads.rows.map(l => ({ id: l.id, email: l.email, sourcePlatform: l.source_platform, createdAt: l.created_at, funnelStage: l.funnel_stage })),
    methodology: 'Time+platform correlation (leads on a matching platform created within the viral window), not exact per-click attribution.',
  });
}
