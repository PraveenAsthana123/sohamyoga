import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { ensureSocialIntelligenceSchema } from '@/lib/social-intelligence-schema';

export async function POST() {
  await ensureSocialIntelligenceSchema();

  const period = new Date().toISOString().slice(0, 7); // '2026-09'
  const platforms = ['youtube', 'facebook', 'instagram', 'x_twitter', 'linkedin', 'tiktok'];
  let upserted = 0;

  for (const platform of platforms) {
    // Aggregate real data from social_post for this platform + period
    const postStats = await query(
      `SELECT
         COUNT(*) as total_posts,
         COALESCE(SUM(spa.impressions), 0) as total_impressions,
         COALESCE(SUM(spa.reach), 0) as total_reach,
         COALESCE(SUM(spa.clicks), 0) as total_clicks,
         COALESCE(SUM(spa.likes), 0) as total_likes,
         COALESCE(SUM(spa.comments), 0) as total_comments,
         COALESCE(SUM(spa.shares), 0) as total_shares,
         COALESCE(SUM(spa.saves), 0) as total_saves,
         CASE WHEN SUM(spa.impressions) > 0
              THEN ROUND((SUM(spa.likes + spa.comments + spa.shares)::NUMERIC / SUM(spa.impressions)) * 100, 3)
              ELSE 0 END as avg_engagement_rate
       FROM social_post sp
       LEFT JOIN social_post_analytics spa ON spa.post_id = sp.id
       WHERE sp.platform = $1
         AND DATE_TRUNC('month', sp.scheduled_at) = DATE_TRUNC('month', NOW())`,
      [platform],
    ).catch(() => ({ rows: [{ total_posts: 0, total_impressions: 0, total_reach: 0, total_clicks: 0, total_likes: 0, total_comments: 0, total_shares: 0, total_saves: 0, avg_engagement_rate: 0 }] }));

    const row = postStats.rows[0];

    await query(
      `INSERT INTO social_platform_analytics
         (platform, period, total_posts, total_impressions, total_reach, total_clicks,
          total_likes, total_comments, total_shares, total_saves, avg_engagement_rate, fetched_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())`,
      [platform, period, row.total_posts, row.total_impressions, row.total_reach, row.total_clicks,
       row.total_likes, row.total_comments, row.total_shares, row.total_saves, row.avg_engagement_rate],
    );
    upserted++;
  }

  return NextResponse.json({ ok: true, period, upserted });
}
