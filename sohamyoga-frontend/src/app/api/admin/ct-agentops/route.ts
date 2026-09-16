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
      CREATE TABLE IF NOT EXISTS agentops_runs (
        id SERIAL PRIMARY KEY,
        agent_name TEXT,
        task TEXT,
        status TEXT DEFAULT 'running',
        steps_completed INTEGER DEFAULT 0,
        total_steps INTEGER DEFAULT 1,
        cost_usd NUMERIC DEFAULT 0,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        output TEXT
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS agentops_agents (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE,
        type TEXT DEFAULT 'autonomous',
        authority_level TEXT DEFAULT 'read_only',
        tools TEXT[],
        avg_success_rate NUMERIC DEFAULT 0,
        total_runs INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const { rows: agentCount } = await client.query('SELECT COUNT(*)::int AS c FROM agentops_agents');
    if (agentCount[0].c === 0) {
      await client.query(`INSERT INTO agentops_agents (name, type, authority_level, tools, avg_success_rate, total_runs) VALUES
        ('ContentBot', 'autonomous', 'write', ARRAY['llm_generate', 'social_post', 'schedule'], 0.94, 47),
        ('ResearchBot', 'autonomous', 'read_only', ARRAY['web_search', 'rag_query', 'summarize'], 0.98, 112),
        ('LeadScoringBot', 'semi_autonomous', 'read_only', ARRAY['crm_read', 'score_model', 'email_draft'], 0.87, 63),
        ('ComplianceBot', 'autonomous', 'read_only', ARRAY['policy_check', 'pii_scan', 'report_gen'], 0.99, 28)`);
    }

    const { rows: runCount } = await client.query('SELECT COUNT(*)::int AS c FROM agentops_runs');
    if (runCount[0].c === 0) {
      await client.query(`INSERT INTO agentops_runs (agent_name, task, status, steps_completed, total_steps, cost_usd, started_at, completed_at, output) VALUES
        ('ContentBot', 'Generate weekly social media posts', 'completed', 5, 5, 0.042, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 55 min', 'Generated 7 posts across Instagram, LinkedIn, Facebook'),
        ('ResearchBot', 'Competitor analysis: top 5 yoga studios', 'completed', 8, 8, 0.018, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 hours 40 min', 'Analysis complete with Porter forces mapping'),
        ('LeadScoringBot', 'Score 45 new leads from last week', 'completed', 3, 3, 0.009, NOW() - INTERVAL '4 hours', NOW() - INTERVAL '3 hours 52 min', '45 leads scored: 12 hot, 18 warm, 15 cold'),
        ('ComplianceBot', 'Daily PII audit scan', 'completed', 2, 2, 0.004, NOW() - INTERVAL '5 hours', NOW() - INTERVAL '4 hours 55 min', 'Scanned 23 AI outputs, 3 PII instances masked'),
        ('ContentBot', 'Draft blog post: benefits of hot yoga', 'failed', 2, 5, 0.015, NOW() - INTERVAL '6 hours', NOW() - INTERVAL '5 hours 30 min', 'Error: LLM timeout after 3 retries'),
        ('ResearchBot', 'Market size analysis: Canadian yoga market', 'completed', 6, 6, 0.022, NOW() - INTERVAL '7 hours', NOW() - INTERVAL '6 hours 30 min', 'Market estimated at CAD 2.1B, growing 8% YoY'),
        ('LeadScoringBot', 'Update CRM scores for existing leads', 'completed', 3, 3, 0.011, NOW() - INTERVAL '8 hours', NOW() - INTERVAL '7 hours 48 min', 'Updated 89 lead scores'),
        ('ContentBot', 'Generate email newsletter draft', 'running', 2, 4, 0.008, NOW() - INTERVAL '20 minutes', NULL, NULL),
        ('ComplianceBot', 'Weekly compliance check run', 'running', 1, 3, 0.003, NOW() - INTERVAL '10 minutes', NULL, NULL),
        ('ResearchBot', 'Keyword research: yoga in Toronto', 'completed', 5, 5, 0.014, NOW() - INTERVAL '10 hours', NOW() - INTERVAL '9 hours 30 min', '47 target keywords identified, 12 high-opportunity'),
        ('LeadScoringBot', 'Score workshop attendee list', 'completed', 3, 3, 0.007, NOW() - INTERVAL '11 hours', NOW() - INTERVAL '10 hours 50 min', '23 attendees scored'),
        ('ContentBot', 'Create TikTok video scripts', 'completed', 4, 4, 0.031, NOW() - INTERVAL '12 hours', NOW() - INTERVAL '11 hours 40 min', '5 video scripts generated'),
        ('ComplianceBot', 'GDPR data subject request check', 'completed', 2, 2, 0.004, NOW() - INTERVAL '13 hours', NOW() - INTERVAL '12 hours 55 min', 'No pending requests found'),
        ('ResearchBot', 'Trending wellness topics analysis', 'completed', 7, 7, 0.019, NOW() - INTERVAL '14 hours', NOW() - INTERVAL '13 hours 20 min', 'Top trends: mindfulness apps, breathwork, somatic yoga'),
        ('LeadScoringBot', 'Monthly lead quality report', 'failed', 1, 4, 0.002, NOW() - INTERVAL '15 hours', NOW() - INTERVAL '14 hours 55 min', 'Error: database connection timeout')`);
    }

    const [statsRes, activeRes] = await Promise.all([
      client.query(`
        SELECT
          COUNT(*)::int AS total_runs,
          COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
          COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
          COUNT(*) FILTER (WHERE status = 'running')::int AS running,
          COUNT(*) FILTER (WHERE started_at >= NOW() - INTERVAL '24 hours')::int AS runs_today,
          ROUND(SUM(cost_usd)::numeric, 4) AS total_cost,
          ROUND(AVG(cost_usd)::numeric, 4) AS avg_cost
        FROM agentops_runs
      `).catch(() => ({ rows: [{ total_runs: 0, completed: 0, failed: 0, running: 0, runs_today: 0, total_cost: 0, avg_cost: 0 }] })),
      client.query(`
        SELECT r.*, a.type, a.authority_level
        FROM agentops_runs r
        LEFT JOIN agentops_agents a ON a.name = r.agent_name
        WHERE r.status = 'running'
        ORDER BY r.started_at DESC
      `).catch(() => ({ rows: [] })),
    ]);

    const st = statsRes.rows[0];
    const total = parseInt(st.total_runs) || 1;
    const completed = parseInt(st.completed) || 0;
    const successRate = Math.round((completed / total) * 100);

    const health_score = Math.min(100,
      (successRate >= 95 ? 50 : successRate >= 80 ? 30 : 10) +
      (parseFloat(st.avg_cost) <= 0.02 ? 30 : parseFloat(st.avg_cost) <= 0.05 ? 20 : 10) +
      (st.running <= 3 ? 20 : 10)
    );

    return Response.json({
      health_score,
      traffic_light: health_score >= 70 ? 'green' : health_score >= 40 ? 'yellow' : 'red',
      success_rate: successRate,
      avg_cost_usd: parseFloat(st.avg_cost),
      runs_today: st.runs_today,
      active_runs: activeRes.rows.length,
      kpis: [
        { label: 'Success Rate', value: successRate, target: 95, trend: successRate >= 95 ? 'up' : 'down', unit: '%' },
        { label: 'Avg Cost/Run', value: `$${parseFloat(st.avg_cost).toFixed(4)}`, target: 0.02, trend: parseFloat(st.avg_cost) <= 0.02 ? 'up' : 'down', unit: 'USD' },
        { label: 'Runs Today', value: st.runs_today, target: 10, trend: st.runs_today >= 10 ? 'up' : 'down', unit: 'runs' },
        { label: 'Active Now', value: activeRes.rows.length, target: 5, trend: 'up', unit: 'agents' },
      ],
      active_runs: activeRes.rows,
      recent_runs: [],
      updated_at: new Date().toISOString(),
    });
  } finally {
    client.release();
  }
}
