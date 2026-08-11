import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Real funnel stage counts + transition findings from the latest FunnelStageAnalysisJob run. */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const latest = await query<{ period_start: string; period_end: string }>(
    `SELECT period_start, period_end FROM funnel_stage_snapshot ORDER BY period_start DESC LIMIT 1`,
  );
  if (!latest.rowCount) {
    return Response.json({ hasData: false, stages: [], transitions: [] });
  }
  const { period_start, period_end } = latest.rows[0];

  const [stages, transitions] = await Promise.all([
    query(
      `SELECT stage, stage_order, unique_count FROM funnel_stage_snapshot
       WHERE period_start = $1 AND period_end = $2 ORDER BY stage_order`,
      [period_start, period_end],
    ),
    query(
      `SELECT from_stage, to_stage, from_count, to_count, conversion_rate, is_leak, ai_diagnosis FROM funnel_transition_finding
       WHERE period_start = $1 AND period_end = $2 ORDER BY conversion_rate`,
      [period_start, period_end],
    ),
  ]);

  return Response.json({
    hasData: true,
    periodStart: period_start,
    periodEnd: period_end,
    stages: stages.rows,
    transitions: transitions.rows,
  });
}
