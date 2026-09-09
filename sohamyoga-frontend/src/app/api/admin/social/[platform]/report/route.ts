import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real per-post analytics report for one platform -- every column comes
// directly from social_post_analytics (impressions, reach, clicks, likes,
// comments, shares, saves, conversions, follower_delta), never estimated.
export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { platform } = await params;

  const result = await query<{
    post_id: string; master_text: string | null; published_at: string | null;
    impressions: string; reach: string; clicks: string; likes: string; comments: string;
    shares: string; saves: string; conversions: string; follower_delta: string; fetched_at: string;
  }>(
    `SELECT sp.id AS post_id, d.master_text, sp.created_at AS published_at,
            spa.impressions, spa.reach, spa.clicks, spa.likes, spa.comments, spa.shares, spa.saves,
            spa.conversions, spa.follower_delta, spa.fetched_at
     FROM social_post sp
     JOIN social_post_analytics spa ON spa.post_id = sp.id
     LEFT JOIN social_content_draft d ON d.id = sp.draft_id
     WHERE sp.platform = $1
     ORDER BY spa.fetched_at DESC
     LIMIT 100`,
    [platform],
  );

  return Response.json({
    generatedAt: new Date().toISOString(),
    platform,
    totalRows: result.rowCount,
    posts: result.rows.map((r) => ({
      postId: r.post_id, excerpt: r.master_text ? r.master_text.slice(0, 140) : null, publishedAt: r.published_at,
      impressions: Number(r.impressions), reach: Number(r.reach), clicks: Number(r.clicks), likes: Number(r.likes),
      comments: Number(r.comments), shares: Number(r.shares), saves: Number(r.saves),
      conversions: Number(r.conversions), followerDelta: Number(r.follower_delta), fetchedAt: r.fetched_at,
    })),
  });
}
