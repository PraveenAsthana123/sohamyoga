// StreakUpdateJob — Daily 02:00 UTC
// Updates practice streaks for all students.
// No Ollama needed — pure DB logic.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

export async function run(): Promise<void> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // 1. Find students who practiced today (have a journal or attendance record today)
  const practiced = await db.query<{ student_id: string }>(`
    SELECT DISTINCT student_id
    FROM practice_journal
    WHERE DATE(session_date) = $1
      AND tenant_id IS NOT NULL
    UNION
    SELECT DISTINCT enrollment_id AS student_id
    FROM attendance_record
    WHERE DATE(date) = $1 AND status = 'present'
  `, [today]);

  const practicedIds = new Set(practiced.rows.map(r => r.student_id));

  // 2. Load all active streaks
  const streaks = await db.query<{
    id: string; student_id: string; current_streak: number;
    last_activity_date: string; freeze_tokens_available: number;
  }>(`
    SELECT id, student_id, current_streak, last_activity_date, freeze_tokens_available
    FROM streak
    WHERE is_active = true
  `);

  let updated = 0, reset = 0, frozen = 0;

  for (const streak of streaks.rows) {
    const lastDate = new Date(streak.last_activity_date);
    const todayDate = new Date(today);
    const daysSince = Math.floor((todayDate.getTime() - lastDate.getTime()) / 86400000);

    if (practicedIds.has(streak.student_id)) {
      // Practiced today — extend streak
      if (daysSince >= 1) {
        await db.query(`
          UPDATE streak
          SET current_streak = current_streak + 1,
              last_activity_date = $1,
              updated_at = NOW()
          WHERE id = $2
        `, [today, streak.id]);

        // Log streak event
        await db.query(`
          INSERT INTO streak_event (streak_id, event_type, event_date, streak_value_after)
          VALUES ($1, 'extended', $2, $3)
        `, [streak.id, today, streak.current_streak + 1]);
        updated++;
      }
    } else if (daysSince === 1) {
      // Missed yesterday — check freeze tokens
      if (streak.freeze_tokens_available > 0) {
        await db.query(`
          UPDATE streak SET
            freeze_tokens_available = freeze_tokens_available - 1,
            updated_at = NOW()
          WHERE id = $1
        `, [streak.id]);
        await db.query(`
          INSERT INTO streak_event (streak_id, event_type, event_date, streak_value_after)
          VALUES ($1, 'freeze_used', $2, $3)
        `, [streak.id, today, streak.current_streak]);
        frozen++;
      } else {
        // Reset streak
        await db.query(`
          UPDATE streak SET
            current_streak = 0,
            updated_at = NOW()
          WHERE id = $1
        `, [streak.id]);
        await db.query(`
          INSERT INTO streak_event (streak_id, event_type, event_date, streak_value_after)
          VALUES ($1, 'broken', $2, 0)
        `, [streak.id, today]);
        reset++;
      }
    }
    // daysSince >= 2: already broken in a prior run
  }

  console.log(`[streak-update] ${today}: extended=${updated} frozen=${frozen} reset=${reset}`);
  await db.end();
}
