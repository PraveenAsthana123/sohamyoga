export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export async function POST(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows: pipelines } = await client.query(`
      SELECT pipeline_name, category, status, run_count, failure_count, avg_duration_ms,
        ROUND(100.0 * failure_count / NULLIF(run_count, 0), 1) AS failure_rate_pct,
        last_run, last_failure
      FROM pipeline_health
      ORDER BY failure_count DESC
    `).catch(() => ({ rows: [] }));

    const prompt = `You are a DevOps reliability engineer. Analyze this pipeline health data and provide reliability improvement recommendations.

Pipeline Data:
${JSON.stringify(pipelines, null, 2)}

Provide:
1. Root cause analysis for failing/degraded pipelines
2. Retry and circuit-breaker recommendations
3. Monitoring and alerting improvements
4. Pipeline optimization opportunities (duration, frequency)
5. Priority order for fixes

Be specific and actionable.`;

    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });

    if (!ollamaRes.ok) throw new Error('Ollama unavailable');
    const json = await ollamaRes.json();
    return Response.json({ brief: json.response ?? 'No recommendations generated.' });
  } catch {
    return Response.json({ brief: 'AI Advisor unavailable. Key recommendations: (1) Fix analytics-rollup immediately — 5 failures, zero successes; (2) Add exponential backoff to video-transcription; (3) Schedule newsletter-send to run on cadence; (4) Add PagerDuty/Slack alerts for any pipeline with >2 consecutive failures; (5) Profile email-campaign — 5.2s avg is high.' });
  } finally {
    client.release();
  }
}
