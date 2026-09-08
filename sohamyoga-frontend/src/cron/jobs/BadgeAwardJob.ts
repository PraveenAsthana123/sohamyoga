// BadgeAwardJob — Daily 04:30 UTC
// Awards badges to students who have earned milestones or met badge conditions.
// No Ollama — rule-based from DB state.
//
// Rewritten against the live schema: streak keys off user_id with no
// is_active column; attendance_record has no `date` column (attended_at);
// pose_assessment has asana_id not pose_id; badge.id IS the slug (no
// separate slug column); achievement keys off user_id and requires a
// NOT NULL source; points_ledger needs amount/reason/balance_after, not
// delta/source/note; notification_queue needs recipient_user_id/
// recipient_address/type. The `referral` table referenced by
// 'referral_champion' does not exist anywhere in this database — that rule
// can never trigger (total_referrals stays 0), documented rather than
// silently wrong.
//
// Real bug fix (2026-09-01, found live during an end-to-end demo): the real
// badge table's ids are b1-b10 (verified via \d), not the descriptive
// slugs ('first_class', 'week_warrior', etc.) this file's own BADGE_RULES
// used -- so activeBadgeIds.has(rule.badgeSlug) was false for every single
// rule, and this job had never awarded one real badge to any student,
// ever. Remapped to the real ids, with conditions matching each real
// badge's own description (verified via `SELECT id, name FROM badge`).
// b8/b9 (community posts) have no real data source anywhere in this
// codebase, same as b10/referral -- correctly left unreachable rather than
// invented.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

interface BadgeRule { badgeSlug: string; condition: string }

const BADGE_RULES: BadgeRule[] = [
  { badgeSlug: 'b1', condition: `total_classes >= 1` },    // First Class
  { badgeSlug: 'b2', condition: `total_classes >= 10` },   // Dedicated Practitioner
  { badgeSlug: 'b3', condition: `total_classes >= 30` },   // Regular Student
  { badgeSlug: 'b4', condition: `total_classes >= 100` },  // Century Club
  { badgeSlug: 'b5', condition: `current_streak >= 7` },   // One Week Warrior
  { badgeSlug: 'b6', condition: `current_streak >= 30` },  // Month of Mindfulness
  { badgeSlug: 'b7', condition: `unique_poses >= 1` },     // Pose Pioneer ("mastered your first pose")
  // b8/b9 (community posts) and b10 (referral) intentionally omitted --
  // no real data source exists for either anywhere in this codebase.
];

export async function run(): Promise<void> {
  let awarded = 0;

  const stats = await db.query<{
    student_id: string; user_id: string; tenant_id: string;
    total_classes: number; current_streak: number;
    wellness_days: number; unique_poses: number;
  }>(`
    SELECT
      s.id AS student_id,
      s.user_id,
      s.tenant_id,
      COUNT(DISTINCT ar.id)::int                                       AS total_classes,
      COALESCE(st.current_streak, 0)                                   AS current_streak,
      COUNT(DISTINCT ws.id) FILTER (WHERE ws.composite_score >= 60)::int AS wellness_days,
      COUNT(DISTINCT pa.asana_id)::int                                 AS unique_poses
    FROM student s
    LEFT JOIN attendance_record ar  ON ar.student_id = s.id AND ar.status = 'attended'
    LEFT JOIN streak st             ON st.user_id = s.user_id
    LEFT JOIN wellness_score ws     ON ws.student_id = s.id
    LEFT JOIN pose_assessment pa    ON pa.student_id = s.id
    WHERE s.status = 'active'
    GROUP BY s.id, s.user_id, s.tenant_id, st.current_streak
  `);

  const badges = await db.query<{ id: string; points_value: number }>(`SELECT id, points_value FROM badge WHERE is_active = true`);
  const activeBadgeIds = new Set(badges.rows.map(b => b.id));
  const badgePoints = new Map(badges.rows.map(b => [b.id, b.points_value]));

  for (const st of stats.rows) {
    for (const rule of BADGE_RULES) {
      if (!activeBadgeIds.has(rule.badgeSlug)) continue;
      if (!evaluateRule(rule.condition, st)) continue;

      const inserted = await db.query(
        `INSERT INTO achievement (tenant_id, user_id, badge_id, source)
         VALUES ($1,$2,$3,'badge_rule')
         ON CONFLICT (tenant_id, user_id, badge_id) DO NOTHING
         RETURNING id`,
        [st.tenant_id, st.user_id, rule.badgeSlug],
      );
      if (!inserted.rows.length) continue; // already earned

      const student = await db.query<{ email: string }>(`SELECT email FROM student WHERE id = $1`, [st.student_id]);
      if (student.rows[0]) {
        await db.query(
          `INSERT INTO notification_queue
             (tenant_id, template_slug, channel, type, recipient_user_id, recipient_address, payload, idempotency_key)
           VALUES ($1,'badge_earned','in_app','alert',$2,$3,$4,$5)
           ON CONFLICT (tenant_id, idempotency_key) DO NOTHING`,
          [st.tenant_id, st.user_id, student.rows[0].email,
            JSON.stringify({ badgeSlug: rule.badgeSlug }),
            `badge_${st.user_id}_${rule.badgeSlug}`],
        );
      }

      // Real bug fix (2026-09-01): this used to award a hardcoded 100
      // points regardless of which badge was earned, ignoring the real
      // badge.points_value column (e.g. "First Class" is really worth 10).
      const pointsValue = badgePoints.get(rule.badgeSlug) ?? 0;
      const prevBalance = await db.query<{ balance_after: number }>(
        `SELECT balance_after FROM points_ledger WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`,
        [st.user_id],
      );
      const newBalance = (prevBalance.rows[0]?.balance_after ?? 0) + pointsValue;
      await db.query(
        `INSERT INTO points_ledger (tenant_id, user_id, amount, balance_after, reason, reference_type)
         VALUES ($1,$2,$3,$4,'badge','badge')`,
        [st.tenant_id, st.user_id, pointsValue, newBalance],
      );

      awarded++;
    }
  }

  console.log(`[badge-award] awarded=${awarded} badges`);
  // Do NOT db.end() here — runner.ts caches this module across every
  // scheduled invocation in the long-lived cron container; ending the pool
  // breaks every run after the first.
}

function evaluateRule(condition: string, stats: Record<string, number | string>): boolean {
  const m = condition.match(/^(\w+)\s*(>=|<=|>|<|===|==)\s*(\d+)$/);
  if (!m) return false;
  const [, field, op, valStr] = m;
  const actual = (stats[field] as number) ?? 0;
  const target = parseInt(valStr, 10);
  switch (op) {
    case '>=': return actual >= target;
    case '<=': return actual <= target;
    case '>':  return actual >  target;
    case '<':  return actual <  target;
    default:   return actual === target;
  }
}
