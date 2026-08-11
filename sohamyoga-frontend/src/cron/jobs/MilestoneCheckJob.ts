// MilestoneCheckJob — Daily 04:00 UTC
// Checks all students against all milestone thresholds.
// Awards XP, badge, and coupon when threshold reached.
// No Ollama — pure DB aggregation.
//
// Rewritten against the live schema: milestone keys off user_id (not
// student_id) and already carries its own reward_xp per row — the job
// previously hardcoded a flat XP_REWARD=500 flat constant it never even had
// a real column to read from. The `referral` table referenced by the
// 'referral' milestone type does not exist anywhere in this database — that
// case is skipped with a one-time warning rather than silently no-op'd.
// points_ledger needs a computed balance_after (NOT NULL, no default) and
// uses amount/reason/reference_id, not delta/source/ref_id. notification_queue
// needs recipient_user_id/recipient_address/type — same fix already applied
// to NotificationDispatchJob and NpsInvitationJob this session.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });
let warnedReferral = false;

export async function run(): Promise<void> {
  let awarded = 0;

  const milestones = await db.query<{
    id: string; user_id: string; tenant_id: string;
    milestone_type: string; threshold: number; current_progress: number; reward_xp: number;
  }>(`
    SELECT id, user_id, tenant_id, milestone_type, threshold, current_progress, reward_xp
    FROM milestone
    WHERE status NOT IN ('earned', 'claimed')
  `);

  for (const m of milestones.rows) {
    let progress = 0;

    switch (m.milestone_type) {
      case 'class_count': {
        const r = await db.query<{ count: string }>(
          `SELECT COUNT(*) FROM attendance_record ar JOIN student s ON s.id = ar.student_id
           WHERE s.user_id = $1 AND ar.status = 'present'`,
          [m.user_id],
        );
        progress = parseInt(r.rows[0].count, 10);
        break;
      }
      case 'streak_days': {
        const r = await db.query<{ longest_streak: number }>(
          `SELECT COALESCE(longest_streak, 0) AS longest_streak FROM streak WHERE user_id = $1`,
          [m.user_id],
        );
        progress = r.rows[0]?.longest_streak ?? 0;
        break;
      }
      case 'wellness_streak': {
        const r = await db.query<{ count: string }>(
          `SELECT COUNT(*) FROM wellness_score ws JOIN student s ON s.id = ws.student_id
           WHERE s.user_id = $1 AND ws.composite_score >= 60`,
          [m.user_id],
        );
        progress = parseInt(r.rows[0].count, 10);
        break;
      }
      case 'referral': {
        // No `referral` table exists anywhere in this database — this
        // milestone type cannot be evaluated. Skip rather than fake a
        // progress value or crash the whole job on a missing relation.
        if (!warnedReferral) {
          console.warn('[milestone-check] milestone_type=referral has no backing table — skipping this type entirely');
          warnedReferral = true;
        }
        continue;
      }
      case 'enrollment_tenure': {
        const r = await db.query<{ days: string }>(
          `SELECT EXTRACT(DAY FROM NOW() - MIN(e.enrolled_at))::int AS days
           FROM enrollment e JOIN student s ON s.id = e.student_id WHERE s.user_id = $1`,
          [m.user_id],
        );
        progress = r.rows[0]?.days ? parseInt(r.rows[0].days, 10) : 0;
        break;
      }
      default:
        continue;
    }

    await db.query(`UPDATE milestone SET current_progress=$1, updated_at=NOW() WHERE id=$2`, [progress, m.id]);

    if (progress >= m.threshold) {
      const now = new Date().toISOString();
      const xp = m.reward_xp || 0;

      await db.query(`UPDATE milestone SET status='earned', earned_at=$1, updated_at=$1 WHERE id=$2`, [now, m.id]);

      if (xp > 0) {
        const prevBalance = await db.query<{ balance_after: number }>(
          `SELECT balance_after FROM points_ledger WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`,
          [m.user_id],
        );
        const newBalance = (prevBalance.rows[0]?.balance_after ?? 0) + xp;
        await db.query(
          `INSERT INTO points_ledger (tenant_id, user_id, amount, balance_after, reason, reference_id, reference_type)
           VALUES ($1,$2,$3,$4,'milestone',$5,'milestone')`,
          [m.tenant_id, m.user_id, xp, newBalance, m.id],
        );
      }

      const student = await db.query<{ email: string }>(`SELECT email FROM student WHERE user_id = $1`, [m.user_id]);
      if (student.rows[0]) {
        await db.query(
          `INSERT INTO notification_queue
             (tenant_id, template_slug, channel, type, recipient_user_id, recipient_address, payload, idempotency_key)
           VALUES ($1,'milestone_earned','in_app','alert',$2,$3,$4,$5)
           ON CONFLICT (tenant_id, idempotency_key) DO NOTHING`,
          [m.tenant_id, m.user_id, student.rows[0].email,
            JSON.stringify({ milestoneType: m.milestone_type, xp }),
            `milestone_${m.id}_${now.split('T')[0]}`],
        );
      }

      awarded++;
    }
  }

  console.log(`[milestone-check] awarded=${awarded}/${milestones.rows.length} milestones`);
  // Do NOT db.end() here — runner.ts caches this module across every
  // scheduled invocation in the long-lived cron container; ending the pool
  // breaks every run after the first.
}
