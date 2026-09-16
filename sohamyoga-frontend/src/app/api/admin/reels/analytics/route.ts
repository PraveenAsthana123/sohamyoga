import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();

    const { rows: totals } = await pool.query(`
      SELECT
        COALESCE(SUM(views),0)::bigint AS total_views,
        COALESCE(SUM(likes),0)::bigint AS total_likes,
        COALESCE(SUM(comments),0)::bigint AS total_comments,
        COALESCE(SUM(shares),0)::bigint AS total_shares,
        COALESCE(SUM(saves),0)::bigint AS total_saves,
        COALESCE(AVG(engagement_rate) FILTER (WHERE engagement_rate > 0),0)::numeric AS avg_engagement_rate,
        COUNT(*)::int AS total_reels,
        COUNT(*) FILTER (WHERE status='posted')::int AS posted_count,
        COUNT(*) FILTER (WHERE posted_at >= NOW() - INTERVAL '30 days')::int AS posted_this_month
      FROM reels
    `);

    const { rows: byPlatform } = await pool.query(`
      SELECT
        platform,
        COUNT(*)::int AS reel_count,
        COALESCE(SUM(views),0)::bigint AS total_views,
        COALESCE(AVG(likes) FILTER (WHERE status='posted'),0)::numeric AS avg_likes,
        COALESCE(AVG(comments) FILTER (WHERE status='posted'),0)::numeric AS avg_comments,
        COALESCE(AVG(engagement_rate) FILTER (WHERE engagement_rate > 0),0)::numeric AS avg_engagement
      FROM reels
      GROUP BY platform
      ORDER BY total_views DESC
    `);

    const { rows: best } = await pool.query(`
      SELECT id, title, platform, views, likes, comments, engagement_rate, posted_at
      FROM reels
      WHERE engagement_rate > 0
      ORDER BY engagement_rate DESC
      LIMIT 3
    `);

    // Best platform
    const bestPlatform = byPlatform.length > 0 ? byPlatform[0].platform : 'instagram';

    // Posting frequency: count posts per day-of-week
    const { rows: byDow } = await pool.query(`
      SELECT
        EXTRACT(DOW FROM posted_at)::int AS dow,
        TO_CHAR(posted_at, 'Dy') AS day_name,
        COUNT(*)::int AS count
      FROM reels
      WHERE posted_at IS NOT NULL
      GROUP BY dow, day_name
      ORDER BY dow
    `);

    // Best time to post (hour of day for posted reels)
    const { rows: byHour } = await pool.query(`
      SELECT
        EXTRACT(HOUR FROM posted_at)::int AS hour,
        platform,
        COUNT(*)::int AS count
      FROM reels
      WHERE posted_at IS NOT NULL
      GROUP BY hour, platform
      ORDER BY count DESC
    `);

    // Seeded best times if no data
    const bestTimes: Record<string, string> = {
      instagram: '7:00 PM',
      tiktok: '9:00 PM',
      linkedin: '8:00 AM',
      youtube_shorts: '12:00 PM',
      facebook: '6:00 PM',
    };
    if (byHour.length > 0) {
      const platformHours: Record<string, number[]> = {};
      for (const r of byHour) {
        if (!platformHours[r.platform]) platformHours[r.platform] = [];
        platformHours[r.platform].push(r.hour);
      }
      for (const [plat, hours] of Object.entries(platformHours)) {
        const h = hours[0];
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        bestTimes[plat] = `${h12}:00 ${ampm}`;
      }
    }

    return Response.json({
      totals: totals[0],
      by_platform: byPlatform,
      best_reels: best,
      best_platform: bestPlatform,
      posting_by_day: byDow,
      best_times: bestTimes,
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
