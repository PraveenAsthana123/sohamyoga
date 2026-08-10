// LeaderboardRefreshJob — Every 10 minutes
// Recalculates gamification leaderboard rankings from points_ledger.
// No Ollama — pure SQL aggregation.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

export async function run(): Promise<void> {
  // Rebuild leaderboard_entry from points_ledger totals
  await db.query(`
    INSERT INTO leaderboard_entry (student_id, tenant_id, period_type, period_key, total_xp, rank)
    SELECT
      student_id,
      tenant_id,
      'all_time'                  AS period_type,
      'all_time'                  AS period_key,
      SUM(delta) FILTER (WHERE delta > 0) AS total_xp,
      RANK() OVER (PARTITION BY tenant_id ORDER BY SUM(delta) FILTER (WHERE delta > 0) DESC) AS rank
    FROM points_ledger
    GROUP BY student_id, tenant_id
    ON CONFLICT (student_id, period_type, period_key) DO UPDATE SET
      total_xp = EXCLUDED.total_xp,
      rank     = EXCLUDED.rank,
      updated_at = NOW()
  `);

  // Weekly leaderboard
  await db.query(`
    INSERT INTO leaderboard_entry (student_id, tenant_id, period_type, period_key, total_xp, rank)
    SELECT
      student_id,
      tenant_id,
      'weekly'                                            AS period_type,
      TO_CHAR(NOW(), 'IYYY-IW')                           AS period_key,
      SUM(delta) FILTER (WHERE delta > 0)                 AS total_xp,
      RANK() OVER (PARTITION BY tenant_id ORDER BY SUM(delta) FILTER (WHERE delta > 0) DESC) AS rank
    FROM points_ledger
    WHERE created_at >= DATE_TRUNC('week', NOW())
    GROUP BY student_id, tenant_id
    ON CONFLICT (student_id, period_type, period_key) DO UPDATE SET
      total_xp = EXCLUDED.total_xp,
      rank     = EXCLUDED.rank,
      updated_at = NOW()
  `);
}
