// GET /api/analytics/cohorts — cohort totals + weekly retention heatmap.

import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const [totals, retention] = await Promise.all([
    query<{ cohort_type: string; user_count: string }>(
      `SELECT cohort_type, SUM(user_count) AS user_count FROM analytics_cohort
       WHERE date_from >= now() - interval '90 days' GROUP BY cohort_type`,
    ),
    query<{ cohort_week: string; period_week: string; retention_rate: string }>(
      `SELECT cohort_week, period_week, retention_rate FROM analytics_retention
       WHERE cohort_week >= now() - interval '90 days' ORDER BY cohort_week, period_week`,
    ),
  ]);

  const totalsByType = Object.fromEntries(totals.rows.map(r => [r.cohort_type, Number(r.user_count)]));

  const weeksByCohort = new Map<string, { period: string; rate: number }[]>();
  for (const r of retention.rows) {
    const key = r.cohort_week;
    if (!weeksByCohort.has(key)) weeksByCohort.set(key, []);
    weeksByCohort.get(key)!.push({ period: r.period_week, rate: Number(r.retention_rate) });
  }
  const heatmap = Array.from(weeksByCohort.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cohortWeek, points]) => ({ cohortWeek, points: points.sort((a, b) => a.period.localeCompare(b.period)) }));

  return Response.json({
    totals: {
      newUsers: totalsByType.new ?? 0,
      returning: totalsByType.returning ?? 0,
      converted: totalsByType.converted ?? 0,
      churned: totalsByType.churned ?? 0,
    },
    heatmap,
  });
}
