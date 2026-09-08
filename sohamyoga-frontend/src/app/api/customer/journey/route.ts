import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real "My Journey" view — replaces 4 separate hardcoded-array mock pages
// (/student/dashboard, /calendar, /history, /challenges). Every number here
// is a real row from the gamification schema (streak/points_ledger/badge/
// achievement/challenge_participation), keyed by the customer's own
// identity user_id, exactly as BadgeAwardJob computes them. A customer with
// no attendance yet honestly sees zeros and an empty badge/challenge list —
// never a fabricated streak or point total.
export async function GET(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { principal } = await getCustomerPrincipal(req);
  const userId = principal!.id;

  const [streak, pointsBalance, recentLedger, earnedBadges, allBadges, challenges, attendance] = await Promise.all([
    query(`SELECT current_streak, longest_streak, last_activity_date, freeze_tokens, total_active_days FROM streak WHERE user_id = $1`, [userId]),
    query<{ balance: number | null }>(`SELECT balance_after AS balance FROM points_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, [userId]),
    query(`SELECT amount, reason, created_at FROM points_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`, [userId]),
    query<{ badge_id: string; earned_at: string; source: string; name: string; description: string; category: string; points_value: number }>(
      `SELECT a.badge_id, a.earned_at, a.source, b.name, b.description, b.category, b.points_value
       FROM achievement a JOIN badge b ON b.id = a.badge_id WHERE a.user_id = $1 ORDER BY a.earned_at DESC`, [userId]),
    query<{ id: string; name: string; description: string; category: string; points_value: number }>(
      `SELECT id, name, description, category, points_value FROM badge WHERE is_active = true ORDER BY category, points_value`),
    query(`SELECT c.id, c.name, c.description, c.metric, c.target_value, c.end_date, cp.current_progress, cp.rank
           FROM challenge c JOIN challenge_participation cp ON cp.challenge_id = c.id
           WHERE cp.user_id = $1 AND c.status = 'active' ORDER BY c.end_date`, [userId]),
    query<{ total: string }>(
      `SELECT count(*)::text AS total FROM attendance_record ar JOIN student s ON s.id = ar.student_id
       WHERE s.user_id = $1 AND ar.status = 'attended'`,
      [userId],
    ),
  ]);

  const earnedIds = new Set(earnedBadges.rows.map(b => b.badge_id));

  return Response.json({
    streak: streak.rows[0] ?? { current_streak: 0, longest_streak: 0, last_activity_date: null, freeze_tokens: 0, total_active_days: 0 },
    pointsBalance: pointsBalance.rows[0]?.balance ?? 0,
    recentLedger: recentLedger.rows,
    earnedBadges: earnedBadges.rows,
    lockedBadges: allBadges.rows.filter(b => !earnedIds.has(b.id)),
    activeChallenges: challenges.rows,
    totalClassesAttended: Number(attendance.rows[0]?.total ?? 0),
  });
}
