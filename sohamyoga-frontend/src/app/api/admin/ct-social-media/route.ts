export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export async function GET(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const [postsRes, accountsRes, tiktokRes, influencersRes, communityRes] = await Promise.all([
      client.query(`
        SELECT COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS last7
        FROM social_posts
      `).catch(() => ({ rows: [{ total: 0, last7: 0 }] })),
      client.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='active')::int AS active FROM social_accounts`).catch(() => ({ rows: [{ total: 0, active: 0 }] })),
      client.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='active')::int AS active FROM tiktok_ads`).catch(() => ({ rows: [{ total: 0, active: 0 }] })),
      client.query(`SELECT COUNT(*)::int AS total FROM influencer_profiles`).catch(() => ({ rows: [{ total: 0 }] })),
      client.query(`SELECT COUNT(*)::int AS total FROM community_members`).catch(() => ({ rows: [{ total: 0 }] })),
    ]);

    const postsLast7 = postsRes.rows[0]?.last7 ?? 0;
    const activeAccounts = accountsRes.rows[0]?.active ?? 0;
    const tiktokActive = tiktokRes.rows[0]?.active ?? 0;
    const influencers = influencersRes.rows[0]?.total ?? 0;
    const community = communityRes.rows[0]?.total ?? 0;

    const postScore = postsLast7 >= 7 ? 34 : postsLast7 >= 3 ? 20 : 0;
    const accountScore = activeAccounts >= 3 ? 33 : activeAccounts >= 1 ? 20 : 0;
    const engagementScore = (tiktokActive > 0 || influencers > 0) ? 33 : 0;
    const health_score = Math.min(100, postScore + accountScore + engagementScore);

    const scheduledRes = await client.query(`
      SELECT id, platform, content_preview, scheduled_at, status
      FROM social_posts
      WHERE scheduled_at > NOW()
      ORDER BY scheduled_at ASC
      LIMIT 10
    `).catch(() => ({ rows: [] }));

    const platformsRes = await client.query(`
      SELECT platform, COUNT(*)::int AS posts, MAX(created_at) AS last_post
      FROM social_posts
      GROUP BY platform
      ORDER BY posts DESC
    `).catch(() => ({ rows: [] }));

    return Response.json({
      health_score,
      traffic_light: health_score >= 70 ? 'green' : health_score >= 40 ? 'yellow' : 'red',
      kpis: [
        { label: 'Posts (7d)', value: postsLast7, target: 7, trend: postsLast7 >= 7 ? 'up' : 'down', unit: 'posts' },
        { label: 'Active Accounts', value: activeAccounts, target: 3, trend: activeAccounts >= 3 ? 'up' : 'down', unit: 'accounts' },
        { label: 'TikTok Ads Active', value: tiktokActive, target: 2, trend: tiktokActive >= 2 ? 'up' : 'down', unit: 'ads' },
        { label: 'Influencers', value: influencers, target: 5, trend: influencers >= 5 ? 'up' : 'down', unit: 'profiles' },
        { label: 'Community Members', value: community, target: 100, trend: community >= 100 ? 'up' : 'down', unit: 'members' },
      ],
      scheduled_posts: scheduledRes.rows,
      platforms: platformsRes.rows,
      updated_at: new Date().toISOString(),
    });
  } finally {
    client.release();
  }
}
