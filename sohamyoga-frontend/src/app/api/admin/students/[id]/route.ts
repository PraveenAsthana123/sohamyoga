import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Real student 360 view, replacing the static DEMO_STUDENT/DEMO_POSES mock
 * (which also referenced Frappe/Chatwoot/ERPNext IDs and fabricated loyalty
 * points/tiers with no real backing). Pulls from the same real tables the
 * gamification cron jobs (StreakUpdateJob/BadgeAwardJob/WellnessScoringJob)
 * already read and write.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const student = await query(
    `SELECT id, user_id, display_name, email, phone, status, journey_phase, experience_level,
            yoga_style_preference, enrolled_at, first_class_at, last_class_at
     FROM student WHERE id = $1`,
    [params.id],
  );
  if (!student.rowCount) return Response.json({ error: 'Student not found.' }, { status: 404 });

  const userId = student.rows[0].user_id;
  const [enrollment, journal, streak, achievements] = await Promise.all([
    query(`SELECT id, status, start_date, enrolled_at FROM enrollment WHERE student_id = $1 ORDER BY enrolled_at DESC LIMIT 1`, [params.id]),
    query(
      `SELECT entry_date, session_type, duration_minutes, mood_before, mood_after, energy_level, notes
       FROM practice_journal WHERE student_id = $1 ORDER BY entry_date DESC LIMIT 10`,
      [params.id],
    ),
    query(`SELECT current_streak, longest_streak, last_activity_date, total_active_days FROM streak WHERE user_id = $1`, [userId]),
    query(`SELECT badge_id, earned_at, source FROM achievement WHERE user_id = $1 ORDER BY earned_at DESC`, [userId]),
  ]);

  return Response.json({
    student: student.rows[0],
    enrollment: enrollment.rows[0] ?? null,
    journal: journal.rows,
    streak: streak.rows[0] ?? null,
    achievements: achievements.rows,
  });
}
