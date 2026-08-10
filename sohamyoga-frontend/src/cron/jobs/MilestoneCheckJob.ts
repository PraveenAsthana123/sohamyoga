// MilestoneCheckJob — Daily 04:00 UTC
// Checks all students against all milestone thresholds.
// Awards XP, badge, and coupon when threshold reached.
// No Ollama — pure DB aggregation.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const XP_REWARD = 500; // XP per milestone

export async function run(): Promise<void> {
  let awarded = 0;

  // Load all in-progress milestones (not yet earned)
  const milestones = await db.query<{
    id: string; student_id: string; tenant_id: string;
    milestone_type: string; threshold: number; current_progress: number;
  }>(`
    SELECT id, student_id, tenant_id, milestone_type, threshold, current_progress
    FROM milestone
    WHERE status IN ('in_progress', 'not_started')
  `);

  for (const m of milestones.rows) {
    let progress = 0;

    // Calculate current progress based on type
    switch (m.milestone_type) {
      case 'class_count': {
        const r = await db.query<{ count: string }>(
          `SELECT COUNT(*) FROM attendance_record WHERE student_id=$1 AND status='present'`,
          [m.student_id],
        );
        progress = parseInt(r.rows[0].count, 10);
        break;
      }
      case 'streak_days': {
        const r = await db.query<{ longest_streak: number }>(
          `SELECT COALESCE(MAX(current_streak), 0) AS longest_streak FROM streak WHERE student_id=$1`,
          [m.student_id],
        );
        progress = r.rows[0].longest_streak;
        break;
      }
      case 'wellness_streak': {
        const r = await db.query<{ count: string }>(
          `SELECT COUNT(*) FROM wellness_score WHERE student_id=$1 AND composite_score >= 60`,
          [m.student_id],
        );
        progress = parseInt(r.rows[0].count, 10);
        break;
      }
      case 'referral': {
        const r = await db.query<{ count: string }>(
          `SELECT COUNT(*) FROM referral WHERE referrer_id=$1 AND status='converted'`,
          [m.student_id],
        );
        progress = parseInt(r.rows[0].count, 10);
        break;
      }
      case 'enrollment_tenure': {
        const r = await db.query<{ days: string }>(
          `SELECT EXTRACT(DAY FROM NOW() - MIN(enrolled_at))::int AS days FROM enrollment WHERE student_id=$1`,
          [m.student_id],
        );
        progress = r.rows[0]?.days ? parseInt(r.rows[0].days, 10) : 0;
        break;
      }
      default:
        continue;
    }

    // Update progress
    await db.query(`
      UPDATE milestone SET current_progress=$1, updated_at=NOW() WHERE id=$2
    `, [progress, m.id]);

    // Award if threshold reached
    if (progress >= m.threshold) {
      const now = new Date().toISOString();

      await db.query(`
        UPDATE milestone SET status='earned', earned_at=$1, updated_at=$1 WHERE id=$2
      `, [now, m.id]);

      // Grant XP to points ledger
      await db.query(`
        INSERT INTO points_ledger (student_id, tenant_id, delta, source, ref_id, note)
        VALUES ($1, $2, $3, 'milestone', $4, 'Milestone reached: ' || $5)
      `, [m.student_id, m.tenant_id, XP_REWARD, m.id, m.milestone_type]);

      // Queue celebration notification
      await db.query(`
        INSERT INTO notification_queue
          (tenant_id, recipient_id, channel, template_slug, payload, idempotency_key)
        VALUES ($1, $2, 'in_app', 'milestone_earned',
          jsonb_build_object('milestone_type', $3, 'xp', $4),
          $5)
        ON CONFLICT (idempotency_key) DO NOTHING
      `, [m.tenant_id, m.student_id, m.milestone_type, XP_REWARD,
          `milestone_${m.id}_${now.split('T')[0]}`]);

      awarded++;
    }
  }

  console.log(`[milestone-check] awarded=${awarded}/${milestones.rows.length} milestones`);
  await db.end();
}
