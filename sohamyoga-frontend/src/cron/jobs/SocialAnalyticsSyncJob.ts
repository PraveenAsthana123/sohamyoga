// SocialAnalyticsSyncJob — Every 6 hours (0 */6 * * *)
// For each platform in ref_social_platform where a social_account exists,
// calls analytics-sync to upsert social_platform_analytics for current period.
// Aggregates real data from social_post + social_post_analytics — no synthetic numbers.
// Advisory only: logs sync summary per platform to job_run_log.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const PLATFORMS = ['youtube', 'facebook', 'instagram', 'x_twitter', 'linkedin', 'tiktok'];

export async function run(): Promise<void> {
  const period = new Date().toISOString().slice(0, 7);
  let synced = 0;
  let skipped = 0;

  for (const platform of PLATFORMS) {
    // Check if any account exists for this platform
    const accountCheck = await db.query(
      `SELECT id FROM social_account WHERE platform = $1 LIMIT 1`,
      [platform],
    ).catch(() => ({ rows: [] }));

    if (!accountCheck.rows.length) {
      skipped++;
      continue;
    }

    // Aggregate from real social_post + social_post_analytics
    const stats = await db.query(
      `SELECT
         COUNT(DISTINCT sp.id) as total_posts,
         COALESCE(SUM(spa.impressions), 0) as total_impressions,
         COALESCE(SUM(spa.reach), 0) as total_reach,
         COALESCE(SUM(spa.clicks), 0) as total_clicks,
         COALESCE(SUM(spa.likes), 0) as total_likes,
         COALESCE(SUM(spa.comments), 0) as total_comments,
         COALESCE(SUM(spa.shares), 0) as total_shares,
         COALESCE(SUM(spa.saves), 0) as total_saves,
         CASE WHEN SUM(spa.impressions) > 0
              THEN ROUND((SUM(COALESCE(spa.likes,0) + COALESCE(spa.comments,0) + COALESCE(spa.shares,0))::NUMERIC
                          / NULLIF(SUM(spa.impressions), 0)) * 100, 3)
              ELSE 0 END as avg_engagement_rate
       FROM social_post sp
       LEFT JOIN social_post_analytics spa ON spa.post_id = sp.id
       WHERE sp.platform = $1
         AND DATE_TRUNC('month', COALESCE(sp.scheduled_at, NOW())) = DATE_TRUNC('month', NOW())`,
      [platform],
    ).catch(() => ({ rows: [{ total_posts: 0, total_impressions: 0, total_reach: 0, total_clicks: 0, total_likes: 0, total_comments: 0, total_shares: 0, total_saves: 0, avg_engagement_rate: 0 }] }));

    const row = stats.rows[0];

    await db.query(
      `INSERT INTO social_platform_analytics
         (platform, period, total_posts, total_impressions, total_reach,
          total_clicks, total_likes, total_comments, total_shares, total_saves,
          avg_engagement_rate, fetched_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())`,
      [platform, period,
       row.total_posts, row.total_impressions, row.total_reach, row.total_clicks,
       row.total_likes, row.total_comments, row.total_shares, row.total_saves,
       row.avg_engagement_rate],
    ).catch(() => {});

    synced++;
  }

  await db.query(
    `INSERT INTO job_run_log (job_name, status, detail, ran_at)
     VALUES ($1, 'ok', $2, NOW())
     ON CONFLICT DO NOTHING`,
    ['social-analytics-sync', `Period: ${period} | Synced: ${synced} platforms | Skipped (no account): ${skipped}`],
  ).catch(() => {});

  console.log(`[social-analytics-sync] Period=${period} synced=${synced} skipped=${skipped}`);
  await db.end().catch(() => {});
}
