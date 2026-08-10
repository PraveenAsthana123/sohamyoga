// BadgeAwardJob — Daily 04:30 UTC
// Awards badges to students who have earned milestones or met badge conditions.
// No Ollama — rule-based from DB state.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

interface BadgeRule {
  badgeSlug: string;
  condition: string; // SQL WHERE clause fragment
}

// Each rule maps a badge to a SQL condition on student stats
const BADGE_RULES: BadgeRule[] = [
  { badgeSlug: 'first_class',      condition: `total_classes >= 1` },
  { badgeSlug: 'week_warrior',     condition: `current_streak >= 7` },
  { badgeSlug: 'month_master',     condition: `current_streak >= 30` },
  { badgeSlug: 'century_club',     condition: `total_classes >= 100` },
  { badgeSlug: 'referral_champion',condition: `total_referrals >= 3` },
  { badgeSlug: 'wellness_keeper',  condition: `wellness_days >= 14` },
  { badgeSlug: 'early_bird',       condition: `morning_classes >= 10` },
  { badgeSlug: 'pose_explorer',    condition: `unique_poses >= 20` },
];

export async function run(): Promise<void> {
  let awarded = 0;

  // Build student stats view inline
  const stats = await db.query<{
    student_id: string; tenant_id: string;
    total_classes: number; current_streak: number;
    total_referrals: number; wellness_days: number;
    morning_classes: number; unique_poses: number;
  }>(`
    SELECT
      s.id AS student_id,
      s.tenant_id,
      COUNT(DISTINCT ar.id)::int                                  AS total_classes,
      COALESCE(st.current_streak, 0)                              AS current_streak,
      COUNT(DISTINCT r.id) FILTER (WHERE r.status='converted')::int AS total_referrals,
      COUNT(DISTINCT ws.id) FILTER (WHERE ws.composite_score>=60)::int AS wellness_days,
      COUNT(DISTINCT ar.id) FILTER (
        WHERE EXTRACT(HOUR FROM ar.date) < 9
      )::int                                                      AS morning_classes,
      COUNT(DISTINCT pa.pose_id)::int                             AS unique_poses
    FROM student s
    LEFT JOIN attendance_record ar  ON ar.student_id=s.id AND ar.status='present'
    LEFT JOIN streak st             ON st.student_id=s.id AND st.is_active=true
    LEFT JOIN referral r            ON r.referrer_id=s.id
    LEFT JOIN wellness_score ws     ON ws.student_id=s.id
    LEFT JOIN pose_assessment pa    ON pa.student_id=s.id
    WHERE s.status = 'active'
    GROUP BY s.id, s.tenant_id, st.current_streak
  `);

  // Load all badge definitions once
  const badges = await db.query<{ id: string; slug: string }>(`
    SELECT id, slug FROM badge WHERE is_active = true
  `);
  const badgeMap = Object.fromEntries(badges.rows.map(b => [b.slug, b.id]));

  for (const st of stats.rows) {
    for (const rule of BADGE_RULES) {
      const badgeId = badgeMap[rule.badgeSlug];
      if (!badgeId) continue;

      // Evaluate rule against this student's stats
      const meetsCondition = evaluateRule(rule.condition, st);
      if (!meetsCondition) continue;

      // Award only if not already earned
      const existing = await db.query(`
        SELECT id FROM achievement WHERE student_id=$1 AND badge_id=$2 LIMIT 1
      `, [st.student_id, badgeId]);

      if (existing.rows.length > 0) continue;

      await db.query(`
        INSERT INTO achievement (student_id, tenant_id, badge_id, earned_at)
        VALUES ($1, $2, $3, NOW())
      `, [st.student_id, st.tenant_id, badgeId]);

      // Queue badge celebration notification
      await db.query(`
        INSERT INTO notification_queue
          (tenant_id, recipient_id, channel, template_slug, payload, idempotency_key)
        VALUES ($1, $2, 'in_app', 'badge_earned',
          jsonb_build_object('badge_slug', $3),
          'badge_' || $2 || '_' || $3)
        ON CONFLICT (idempotency_key) DO NOTHING
      `, [st.tenant_id, st.student_id, rule.badgeSlug]);

      // Grant bonus XP
      await db.query(`
        INSERT INTO points_ledger (student_id, tenant_id, delta, source, note)
        VALUES ($1, $2, 100, 'badge', 'Badge earned: ' || $3)
      `, [st.student_id, st.tenant_id, rule.badgeSlug]);

      awarded++;
    }
  }

  console.log(`[badge-award] awarded=${awarded} badges`);
  await db.end();
}

function evaluateRule(condition: string, stats: Record<string, number | string>): boolean {
  // Simple rule evaluator — parses "field >= N" and "field < N"
  const m = condition.match(/^(\w+)\s*(>=|<=|>|<|===|==)\s*(\d+)$/);
  if (!m) return false;
  const [, field, op, valStr] = m;
  const actual = stats[field] as number ?? 0;
  const target = parseInt(valStr, 10);
  switch (op) {
    case '>=': return actual >= target;
    case '<=': return actual <= target;
    case '>':  return actual >  target;
    case '<':  return actual <  target;
    default:   return actual === target;
  }
}
