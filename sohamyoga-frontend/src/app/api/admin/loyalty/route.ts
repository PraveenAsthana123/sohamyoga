import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const [achievements, streaks, leaderboard, rewards30d, kpi] = await Promise.all([
      client.query(
        `SELECT a.id, a.badge_id, a.earned_at, a.source,
                b.name AS badge_name, b.description AS badge_desc, b.icon_url
         FROM achievement a
         JOIN badge b ON b.id = a.badge_id
         ORDER BY a.earned_at DESC LIMIT 100`,
      ).catch(() => ({ rows: [] })),
      client.query(
        `SELECT s.id, s.user_id, s.current_streak, s.longest_streak,
                s.last_activity_date, s.total_active_days,
                au.email AS user_email, au.display_name
         FROM streak s
         LEFT JOIN app_user au ON au.id = s.user_id
         WHERE s.current_streak > 0
         ORDER BY s.current_streak DESC LIMIT 100`,
      ).catch(() => ({ rows: [] })),
      client.query(
        `SELECT le.rank, le.display_name, le.score, le.board_type, le.board_period,
                le.delta_rank, le.snapshotted_at
         FROM leaderboard_entry le
         ORDER BY le.rank ASC LIMIT 20`,
      ).catch(() => ({ rows: [] })),
      client.query(
        `SELECT reward_type, COUNT(*)::int AS cnt,
                COUNT(*) FILTER (WHERE claimed_at IS NOT NULL)::int AS claimed
         FROM reward_transaction
         WHERE issued_at >= NOW() - INTERVAL '30 days'
         GROUP BY reward_type`,
      ).catch(() => ({ rows: [] })),
      client.query(
        `SELECT
           (SELECT COUNT(*)::int FROM achievement) AS total_achievements,
           (SELECT COUNT(*)::int FROM streak WHERE current_streak > 0) AS active_streaks,
           (SELECT COUNT(*)::int FROM reward_transaction WHERE claimed_at IS NOT NULL) AS rewards_redeemed,
           (SELECT MAX(score)::bigint FROM leaderboard_entry) AS top_score`,
      ).catch(() => ({ rows: [{ total_achievements: 0, active_streaks: 0, rewards_redeemed: 0, top_score: 0 }] })),
    ]);

    return Response.json({
      achievements: achievements.rows,
      streaks: streaks.rows,
      leaderboard: leaderboard.rows,
      rewards30d: rewards30d.rows,
      kpi: kpi.rows[0],
    });
  } finally {
    client.release();
  }
}
