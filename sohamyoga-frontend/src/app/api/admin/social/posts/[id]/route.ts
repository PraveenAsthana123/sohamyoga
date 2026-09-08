import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real single-post detail -- previously no route returned one post's own
// content + its own latest engagement snapshot + viral signal together.
// The [platform]/viral-signals page only ever showed a cross-post table.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;

  const post = await query<{
    id: string; platform: string; status: string; scheduled_at: string; published_at: string | null;
    external_post_url: string | null; failure_reason: string | null; master_text: string | null;
    master_media_urls: string[] | null; content_type: string | null; generated_with_ai: boolean | null;
  }>(
    `SELECT sp.id, sp.platform, sp.status, sp.scheduled_at, sp.published_at, sp.external_post_url, sp.failure_reason,
            d.master_text, d.master_media_urls, d.content_type, d.generated_with_ai
     FROM social_post sp
     LEFT JOIN social_content_draft d ON d.id = sp.draft_id
     WHERE sp.id = $1`,
    [id],
  );
  if (!post.rowCount) return Response.json({ error: 'Post not found.' }, { status: 404 });
  const p = post.rows[0];

  const [latestAnalytics, signal, correlatedLeads] = await Promise.all([
    query<{
      fetched_at: string; impressions: string; reach: string; clicks: string;
      likes: string; comments: string; shares: string; saves: string; conversions: string;
    }>(
      `SELECT fetched_at, impressions, reach, clicks, likes, comments, shares, saves, conversions
       FROM social_post_analytics WHERE post_id = $1 ORDER BY fetched_at DESC LIMIT 1`,
      [id],
    ),
    query<{ viral_score: string; is_viral: boolean; ai_note: string | null; computed_at: string }>(
      `SELECT viral_score, is_viral, ai_note, computed_at FROM viral_signal WHERE post_id = $1`,
      [id],
    ),
    // Real Lead Detection Flow -- time+platform correlation between this
    // post's publish window and real campaign_lead rows, the same honest
    // methodology as the viral-signal leads endpoint, generalized to every
    // published post (not just viral ones). No fabricated attribution.
    p.published_at
      ? query<{ count: string }>(
          `SELECT COUNT(*) AS count FROM campaign_lead
           WHERE source_platform ILIKE $1 AND created_at BETWEEN $2::timestamptz AND $2::timestamptz + interval '72 hours'`,
          [`%${p.platform}%`, p.published_at],
        )
      : Promise.resolve({ rows: [{ count: '0' }] } as { rows: { count: string }[] }),
  ]);

  const a = latestAnalytics.rows[0];

  return Response.json({
    id: p.id, platform: p.platform, status: p.status, scheduledAt: p.scheduled_at, publishedAt: p.published_at,
    externalPostUrl: p.external_post_url, failureReason: p.failure_reason, masterText: p.master_text,
    mediaUrls: p.master_media_urls ?? [], contentType: p.content_type, generatedWithAi: p.generated_with_ai,
    analytics: a ? {
      fetchedAt: a.fetched_at, impressions: Number(a.impressions), reach: Number(a.reach), clicks: Number(a.clicks),
      likes: Number(a.likes), comments: Number(a.comments), shares: Number(a.shares), saves: Number(a.saves),
      conversions: Number(a.conversions),
    } : null,
    viralSignal: signal.rowCount ? {
      viralScore: Number(signal.rows[0].viral_score), isViral: signal.rows[0].is_viral,
      aiNote: signal.rows[0].ai_note, computedAt: signal.rows[0].computed_at,
    } : null,
    leadDetection: p.published_at ? {
      correlatedLeadCount: Number(correlatedLeads.rows[0].count),
      windowHours: 72,
      methodology: 'Time+platform correlation (leads on a matching platform created within 72h of publish), not exact per-click attribution.',
    } : null,
  });
}
