// LeaderboardRefreshJob — Every 10 minutes
// Recalculates gamification leaderboard rankings from points_ledger.
// No Ollama — pure SQL aggregation.
//
// Previously targeted columns that don't exist on either table
// (points_ledger.student_id/delta, leaderboard_entry.student_id/period_type/
// period_key/total_xp/updated_at) — every run failed with a real "column does
// not exist" error, confirmed in the live cron container's logs. Real
// columns (verified via \d against the live DB): points_ledger has user_id/
// amount, not student_id/delta; leaderboard_entry has user_id/board_type/
// board_period/score/display_name, not student_id/period_type/period_key/
// total_xp. display_name is NOT NULL on leaderboard_entry and isn't on
// points_ledger at all — joined from student.display_name via user_id.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

async function refresh(boardPeriod: string, since: string | null): Promise<number> {
  const result = await db.query(
    `WITH totals AS (
       SELECT pl.tenant_id, pl.user_id, s.display_name,
              SUM(pl.amount) FILTER (WHERE pl.amount > 0) AS score
       FROM points_ledger pl
       JOIN student s ON s.user_id = pl.user_id
       WHERE ($1::timestamptz IS NULL OR pl.created_at >= $1::timestamptz)
       GROUP BY pl.tenant_id, pl.user_id, s.display_name
       HAVING SUM(pl.amount) FILTER (WHERE pl.amount > 0) > 0
     ),
     ranked AS (
       SELECT *, RANK() OVER (PARTITION BY tenant_id ORDER BY score DESC) AS rank
       FROM totals
     )
     INSERT INTO leaderboard_entry (tenant_id, board_type, board_period, user_id, display_name, score, rank)
     SELECT tenant_id, 'xp', $2, user_id, display_name, score, rank FROM ranked
     ON CONFLICT (tenant_id, board_type, board_period, user_id) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       score = EXCLUDED.score,
       delta_rank = leaderboard_entry.rank - EXCLUDED.rank,
       rank = EXCLUDED.rank,
       snapshotted_at = now()
     RETURNING id`,
    [since, boardPeriod],
  );
  return result.rowCount ?? 0;
}

export async function run(): Promise<void> {
  const allTime = await refresh('all_time', null);

  const now = new Date();
  const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7)); // Monday
  const weekly = await refresh(isoWeek(now), weekStart.toISOString());

  console.log(`[leaderboard-refresh] all_time=${allTime} weekly=${weekly} entries updated`);
  // Do NOT db.end() here — runner.ts caches this module across every
  // scheduled invocation in the long-lived cron container; ending the pool
  // breaks every run after the first.
}
