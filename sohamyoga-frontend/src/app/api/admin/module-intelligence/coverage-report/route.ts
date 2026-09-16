import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { ensureSchema } from '@/lib/module-intelligence-schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest): Promise<NextResponse> {
  await ensureSchema();

  const [coverage, trend, polarity] = await Promise.all([
    // Module coverage
    query(`
      SELECT
        mr.module_key,
        mr.name,
        mr.built_status,
        COUNT(DISTINCT tce.id) as total_cases,
        COUNT(DISTINCT tce.id) FILTER (WHERE tce.status = 'pass') as pass_count,
        COUNT(DISTINCT tce.id) FILTER (WHERE tce.status = 'fail') as fail_count,
        COUNT(DISTINCT tce.id) FILTER (WHERE tce.status = 'skip') as skip_count,
        COUNT(DISTINCT tce.id) FILTER (WHERE tce.status = 'pending') as pending_count,
        MAX(tce.last_run_at) as last_run_at,
        CASE WHEN COUNT(DISTINCT tce.id) FILTER (WHERE tce.status IN ('pass','fail')) > 0
          THEN ROUND(100.0 * COUNT(DISTINCT tce.id) FILTER (WHERE tce.status='pass') /
               NULLIF(COUNT(DISTINCT tce.id) FILTER (WHERE tce.status IN ('pass','fail')),0), 2)
          ELSE 0
        END as pass_rate
      FROM module_registry mr
      LEFT JOIN test_case_extended tce ON tce.module_key = mr.module_key
      GROUP BY mr.module_key, mr.name, mr.built_status
      ORDER BY pass_rate DESC NULLS LAST, mr.module_key
    `),
    // 30-day trend
    query(`
      SELECT
        DATE(run_at) as run_date,
        COUNT(DISTINCT session_id) as run_count,
        COUNT(*) as cases_executed,
        COUNT(*) FILTER (WHERE status='pass') as passed,
        ROUND(100.0 * COUNT(*) FILTER (WHERE status='pass') / NULLIF(COUNT(*) FILTER (WHERE status IN ('pass','fail')),0), 2) as pass_rate
      FROM test_run_result
      WHERE run_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(run_at)
      ORDER BY run_date DESC
    `),
    // Polarity breakdown
    query(`
      SELECT
        module_key,
        COUNT(*) FILTER (WHERE polarity='positive') as positive,
        COUNT(*) FILTER (WHERE polarity='negative') as negative,
        COUNT(*) FILTER (WHERE polarity='boundary') as boundary,
        COUNT(*) FILTER (WHERE polarity='stress') as stress
      FROM test_case_extended
      GROUP BY module_key
      ORDER BY module_key
    `),
  ]);

  return NextResponse.json({
    coverage: coverage.rows,
    trend: trend.rows,
    polarity: polarity.rows,
    generated_at: new Date().toISOString(),
  });
}
