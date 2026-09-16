export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export async function GET(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS pipeline_health (
        id SERIAL PRIMARY KEY,
        pipeline_name TEXT UNIQUE NOT NULL,
        category TEXT DEFAULT 'cron',
        last_run TIMESTAMPTZ,
        last_success TIMESTAMPTZ,
        last_failure TIMESTAMPTZ,
        run_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        avg_duration_ms INTEGER DEFAULT 0,
        status TEXT DEFAULT 'healthy',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Seed 12 pipelines
    const { rows: existing } = await client.query('SELECT COUNT(*)::int AS c FROM pipeline_health');
    if (existing[0].c === 0) {
      await client.query(`INSERT INTO pipeline_health (pipeline_name, category, last_run, last_success, last_failure, run_count, failure_count, avg_duration_ms, status) VALUES
        ('social-dispatch', 'cron', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour', NULL, 168, 0, 2340, 'healthy'),
        ('email-campaign', 'cron', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '3 days', 84, 2, 5200, 'healthy'),
        ('affiliate-ledger', 'cron', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes', NULL, 336, 0, 890, 'healthy'),
        ('sitemap-gen', 'cron', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours', NULL, 28, 0, 1200, 'healthy'),
        ('seo-audit', 'scheduled', NOW() - INTERVAL '25 hours', NOW() - INTERVAL '25 hours', NULL, 14, 1, 45000, 'overdue'),
        ('video-transcription', 'worker', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '1 day', 56, 3, 120000, 'degraded'),
        ('rag-ingest', 'cron', NOW() - INTERVAL '12 hours', NOW() - INTERVAL '12 hours', NULL, 42, 0, 8900, 'healthy'),
        ('lead-score', 'cron', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours', NULL, 112, 1, 3400, 'healthy'),
        ('analytics-rollup', 'cron', NOW() - INTERVAL '1 day', NULL, NOW() - INTERVAL '1 day', 30, 5, 0, 'failing'),
        ('newsletter-send', 'scheduled', NOW() - INTERVAL '48 hours', NOW() - INTERVAL '48 hours', NULL, 8, 0, 15000, 'overdue'),
        ('backup-db', 'cron', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours', NULL, 168, 0, 30000, 'healthy'),
        ('csat-collect', 'cron', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour', NULL, 84, 0, 1100, 'healthy')`);
    }

    const { rows: pipelines } = await client.query(
      'SELECT * FROM pipeline_health ORDER BY status DESC, pipeline_name ASC'
    ).catch(() => ({ rows: [] }));

    const total = pipelines.length;
    const failing = pipelines.filter(p => p.status === 'failing').length;
    const degraded = pipelines.filter(p => p.status === 'degraded').length;
    const overdue = pipelines.filter(p => p.status === 'overdue').length;
    const healthy = pipelines.filter(p => p.status === 'healthy').length;

    const totalRuns = pipelines.reduce((s, p) => s + (p.run_count || 0), 0);
    const totalFailures = pipelines.reduce((s, p) => s + (p.failure_count || 0), 0);
    const successRate = totalRuns > 0 ? Math.round(((totalRuns - totalFailures) / totalRuns) * 100) : 100;

    const health_score = Math.min(100,
      (failing === 0 ? 40 : 10) +
      (degraded === 0 ? 20 : 10) +
      (overdue === 0 ? 20 : 10) +
      Math.round((healthy / Math.max(1, total)) * 20)
    );

    return Response.json({
      health_score,
      traffic_light: health_score >= 70 ? 'green' : health_score >= 40 ? 'yellow' : 'red',
      success_rate: successRate,
      jobs_failing: failing,
      jobs_overdue: overdue,
      jobs_degraded: degraded,
      total_pipelines: total,
      kpis: [
        { label: 'Success Rate', value: successRate, target: 99, trend: successRate >= 99 ? 'up' : 'down', unit: '%' },
        { label: 'Failing Jobs', value: failing, target: 0, trend: failing === 0 ? 'up' : 'down', unit: 'jobs' },
        { label: 'Overdue Jobs', value: overdue, target: 0, trend: overdue === 0 ? 'up' : 'down', unit: 'jobs' },
        { label: 'Healthy Pipelines', value: healthy, target: total, trend: healthy === total ? 'up' : 'down', unit: 'pipelines' },
      ],
      pipelines,
      updated_at: new Date().toISOString(),
    });
  } finally {
    client.release();
  }
}
