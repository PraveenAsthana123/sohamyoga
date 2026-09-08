// StreakUpdateJob — Daily 02:00 UTC
// Updates practice streaks for all students.
// No Ollama needed — pure DB logic.
//
// Rewritten against the live schema (verified via \d, was previously
// targeting columns that don't exist on any of these three tables):
// practice_journal.entry_date not session_date; attendance_record already
// has a direct student_id column (enrollment_id AS student_id was wrong on
// two counts — the column doesn't exist, and enrollment.id isn't a student
// id anyway); streak/streak_event key off user_id (matching student.user_id,
// not student.id) with columns freeze_tokens/streak_value/occurred_at, no
// streak_id FK on streak_event and no is_active flag on streak at all.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

// node-pg returns DATE columns as JS Date objects with a local-timezone-
// shifted time component (e.g. 2026-08-10T06:00:00.000Z in MDT, not
// T00:00:00.000Z) — diffing that directly against a UTC-midnight parsed
// date string produces a fractional-day error that silently breaks any
// `daysSince >= 1` threshold right at the boundary. Normalize both sides to
// a UTC-midnight timestamp from the calendar date only before diffing.
function dateOnlyMs(d: Date | string): number {
  const s = typeof d === 'string' ? d : d.toISOString().slice(0, 10);
  return new Date(`${s}T00:00:00.000Z`).getTime();
}

export async function run(): Promise<void> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // 1. Find students (by user_id + tenant_id) who practiced today (journal
  // or attendance). Real bug fix (2026-09-01, found live during an
  // end-to-end demo): this checked ar.status = 'present', a value that has
  // never existed in attendance_record's real enum ('attended'/'absent'/
  // 'excused'/'late') -- so this half of the UNION could never match
  // anything, ever, for any student.
  const practiced = await db.query<{ user_id: string; tenant_id: string }>(`
    SELECT DISTINCT s.user_id, s.tenant_id
    FROM practice_journal pj
    JOIN student s ON s.id = pj.student_id
    WHERE pj.entry_date = $1
    UNION
    SELECT DISTINCT s.user_id, s.tenant_id
    FROM attendance_record ar
    JOIN student s ON s.id = ar.student_id
    WHERE DATE(ar.attended_at) = $1 AND ar.status = 'attended'
  `, [today]);

  // Real bug fix (2026-09-01): nothing anywhere in this codebase ever
  // INSERTed a streak row for a new student, so this job's own `UPDATE
  // streak ... WHERE id = $id` loop had zero rows to act on for any
  // student who had never been manually seeded one -- gamification was
  // structurally unreachable. Onboard first-time practicers here.
  for (const p of practiced.rows) {
    await db.query(
      `INSERT INTO streak (tenant_id, user_id) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING`,
      [p.tenant_id, p.user_id],
    );
  }

  const practicedUserIds = new Set(practiced.rows.map(r => r.user_id));

  // 2. Load all streaks (no soft-delete/active flag on this table)
  const streaks = await db.query<{
    id: string; user_id: string; current_streak: number; longest_streak: number;
    last_activity_date: string | null; freeze_tokens: number;
  }>(`SELECT id, user_id, current_streak, longest_streak, last_activity_date, freeze_tokens FROM streak`);

  let updated = 0, reset = 0, frozen = 0;

  for (const streak of streaks.rows) {
    const daysSince = streak.last_activity_date
      ? Math.round((dateOnlyMs(today) - dateOnlyMs(streak.last_activity_date)) / 86400000)
      : Infinity;

    if (practicedUserIds.has(streak.user_id)) {
      if (daysSince >= 1) {
        const newStreak = streak.current_streak + 1;
        await db.query(
          `UPDATE streak SET current_streak = $1, longest_streak = GREATEST(longest_streak, $1),
             total_active_days = total_active_days + 1, last_activity_date = $2, updated_at = NOW()
           WHERE id = $3`,
          [newStreak, today, streak.id],
        );
        await db.query(
          `INSERT INTO streak_event (tenant_id, user_id, event_type, streak_value, occurred_at)
           SELECT tenant_id, user_id, 'extended', $1, NOW() FROM streak WHERE id = $2`,
          [newStreak, streak.id],
        );
        updated++;
      }
    } else if (daysSince === 1) {
      if (streak.freeze_tokens > 0) {
        await db.query(`UPDATE streak SET freeze_tokens = freeze_tokens - 1, updated_at = NOW() WHERE id = $1`, [streak.id]);
        await db.query(
          `INSERT INTO streak_event (tenant_id, user_id, event_type, streak_value, occurred_at)
           SELECT tenant_id, user_id, 'freeze_used', $1, NOW() FROM streak WHERE id = $2`,
          [streak.current_streak, streak.id],
        );
        frozen++;
      } else {
        await db.query(`UPDATE streak SET current_streak = 0, updated_at = NOW() WHERE id = $1`, [streak.id]);
        await db.query(
          `INSERT INTO streak_event (tenant_id, user_id, event_type, streak_value, occurred_at)
           SELECT tenant_id, user_id, 'broken', 0, NOW() FROM streak WHERE id = $1`,
          [streak.id],
        );
        reset++;
      }
    }
    // daysSince >= 2 or already 0: nothing to do, already broken in a prior run
  }

  console.log(`[streak-update] ${today}: extended=${updated} frozen=${frozen} reset=${reset}`);
  // Do NOT db.end() here — runner.ts caches this module across every
  // scheduled invocation in the long-lived cron container; ending the pool
  // breaks every run after the first.
}
