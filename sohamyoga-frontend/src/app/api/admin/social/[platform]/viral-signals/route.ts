import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Real viral_signal rows for one platform, computed by ViralDetectionJob
 * from social_post_analytics velocity vs each account's own baseline.
 * Also reports connected-account and published-post counts so the page can
 * explain a real "no data yet" state honestly (no account connected /
 * connected but not enough snapshots) rather than showing a blank screen.
 */
export async function GET(req: NextRequest, { params }: { params: { platform: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const platform = params.platform;

  const [accounts, publishedPosts, signals] = await Promise.all([
    query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM social_account WHERE platform = $1 AND status = 'active'`, [platform]),
    query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM social_post WHERE platform = $1 AND status = 'published'`, [platform]),
    query<{
      post_id: string; share_velocity: string; like_velocity: string; comment_velocity: string;
      z_score: string | null; viral_score: string; is_viral: boolean; ai_note: string | null; computed_at: string;
      master_text: string | null; external_post_url: string | null;
    }>(
      `SELECT vs.post_id, vs.share_velocity, vs.like_velocity, vs.comment_velocity, vs.z_score, vs.viral_score,
              vs.is_viral, vs.ai_note, vs.computed_at, d.master_text, sp.external_post_url
       FROM viral_signal vs
       JOIN social_post sp ON sp.id = vs.post_id
       LEFT JOIN social_content_draft d ON d.id = sp.draft_id
       WHERE vs.platform = $1
       ORDER BY vs.viral_score DESC
       LIMIT 50`,
      [platform],
    ),
  ]);

  return Response.json({
    platform,
    connectedAccounts: Number(accounts.rows[0].n),
    publishedPosts: Number(publishedPosts.rows[0].n),
    signals: signals.rows.map(s => ({
      postId: s.post_id,
      excerpt: s.master_text ? s.master_text.slice(0, 140) : null,
      url: s.external_post_url,
      shareVelocity: Number(s.share_velocity),
      likeVelocity: Number(s.like_velocity),
      commentVelocity: Number(s.comment_velocity),
      zScore: s.z_score !== null ? Number(s.z_score) : null,
      viralScore: Number(s.viral_score),
      isViral: s.is_viral,
      aiNote: s.ai_note,
      computedAt: s.computed_at,
    })),
  });
}
