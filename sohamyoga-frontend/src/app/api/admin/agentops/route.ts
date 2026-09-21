import { NextRequest } from 'next/server';
import { getPool } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS aops_runs (
        run_id VARCHAR(64) PRIMARY KEY,
        agent_name VARCHAR(128) NOT NULL,
        model_used VARCHAR(64),
        status VARCHAR(16) NOT NULL DEFAULT 'running',
        input_text TEXT,
        output_text TEXT,
        tokens_used INT,
        cost_usd NUMERIC(10,4),
        latency_ms INT,
        started_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS aops_traces (
        id SERIAL PRIMARY KEY,
        run_id VARCHAR(64) NOT NULL,
        step_number INT NOT NULL,
        action_type VARCHAR(32),
        input_text TEXT,
        output_text TEXT,
        latency_ms INT,
        status VARCHAR(16) NOT NULL DEFAULT 'success',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS aops_alerts (
        id SERIAL PRIMARY KEY,
        metric VARCHAR(64) NOT NULL,
        threshold NUMERIC(12,4) NOT NULL,
        operator VARCHAR(8) NOT NULL DEFAULT '>',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS aops_settings (
        key VARCHAR(64) PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    const { rows: rRows } = await client.query('SELECT COUNT(*) FROM aops_runs');
    if (parseInt(rRows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO aops_runs (run_id, agent_name, model_used, status, input_text, output_text, tokens_used, cost_usd, latency_ms, started_at, completed_at) VALUES
        ('run-001', 'Marketing Agent',      'gpt-4o',      'success', 'Write a blog post about yoga benefits',         'Yoga offers numerous physical and mental health...', 1820, 0.0546, 4320,  NOW()-INTERVAL '2 hours',   NOW()-INTERVAL '2 hours' + INTERVAL '5 seconds'),
        ('run-002', 'Analytics Agent',      'claude-3-5',  'success', 'Summarise Q3 revenue metrics',                  'Q3 revenue grew 18% YoY driven by online sales...',  940, 0.0141, 2110,  NOW()-INTERVAL '90 minutes', NOW()-INTERVAL '90 minutes' + INTERVAL '3 seconds'),
        ('run-003', 'Social Media Agent',   'llama3.1',    'failed',  'Draft 5 Instagram captions for new classes',    NULL,                                                 310, 0.0000, 8900,  NOW()-INTERVAL '1 hour',    NOW()-INTERVAL '1 hour' + INTERVAL '9 seconds'),
        ('run-004', 'Content Writer Agent', 'gpt-4o',      'success', 'Create email newsletter for September',         'Subject: Transform Your Mind & Body This Fall...',  2460, 0.0738, 5800,  NOW()-INTERVAL '45 minutes', NOW()-INTERVAL '45 minutes' + INTERVAL '6 seconds'),
        ('run-005', 'Customer Support Agent','mixtral-8x7b','success', 'Handle refund request from user #4891',        'Thank you for reaching out. Your refund has been...', 520, 0.0000, 1350,  NOW()-INTERVAL '30 minutes', NOW()-INTERVAL '30 minutes' + INTERVAL '2 seconds'),
        ('run-006', 'Data Pipeline Agent',  'claude-3-5',  'running', 'Ingest and tag 200 new knowledge base docs',    NULL,                                                NULL, NULL,   NULL,  NOW()-INTERVAL '10 minutes', NULL),
        ('run-007', 'Marketing Agent',      'gpt-4o',      'success', 'Generate Google Ads copy for fall campaign',    '5 ad variants created with CTR-optimised copy...',  1100, 0.0330, 3100,  NOW()-INTERVAL '20 minutes', NOW()-INTERVAL '20 minutes' + INTERVAL '4 seconds'),
        ('run-008', 'Analytics Agent',      'llama3.1',    'failed',  'Compute churn probability for 500 customers',   NULL,                                                 650, 0.0000, 12400, NOW()-INTERVAL '15 minutes', NOW()-INTERVAL '15 minutes' + INTERVAL '13 seconds'),
        ('run-009', 'Content Writer Agent', 'mixtral-8x7b','success', 'Write 3 landing page headlines for yoga studio','Transform Your Practice | Find Your Zen | ...',        380, 0.0000, 980,   NOW()-INTERVAL '5 minutes',  NOW()-INTERVAL '5 minutes' + INTERVAL '1 second'),
        ('run-010', 'Social Media Agent',   'gpt-4o',      'success', 'Schedule 7 posts for this week across channels','Posts queued: Mon-FB, Tue-IG, Wed-LI, ...',          720, 0.0216, 2600,  NOW()-INTERVAL '2 minutes',  NOW()-INTERVAL '2 minutes' + INTERVAL '3 seconds')
      `);
    }

    const { rows: tRows } = await client.query('SELECT COUNT(*) FROM aops_traces');
    if (parseInt(tRows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO aops_traces (run_id, step_number, action_type, input_text, output_text, latency_ms, status, created_at) VALUES
        ('run-001', 1, 'retrieval',  'yoga benefits knowledge base query',   '12 documents retrieved, top score 0.91',   410,  'success', NOW()-INTERVAL '2 hours'),
        ('run-001', 2, 'llm_call',   'Summarise retrieved docs into outline', '5-section outline generated',              1200, 'success', NOW()-INTERVAL '2 hours'),
        ('run-001', 3, 'llm_call',   'Expand outline into full draft',        '800-word draft produced',                  2500, 'success', NOW()-INTERVAL '2 hours'),
        ('run-001', 4, 'decision',   'Quality score threshold check',         'Score 0.87 > 0.75 — approved for output',  210,  'success', NOW()-INTERVAL '2 hours'),
        ('run-002', 1, 'tool_call',  'db_query: SELECT revenue FROM orders',  '{"Q3_total": 142800, "growth_pct": 18.2}', 350,  'success', NOW()-INTERVAL '90 minutes'),
        ('run-002', 2, 'llm_call',   'Interpret query results, write summary','Narrative summary with 3 key findings',    1560, 'success', NOW()-INTERVAL '90 minutes'),
        ('run-002', 3, 'tool_call',  'api_call: fetch benchmark data',        '{"industry_avg_growth": 12.1}',            200,  'success', NOW()-INTERVAL '90 minutes'),
        ('run-002', 4, 'llm_call',   'Compare results to industry benchmark', 'Final report: 18.2% vs 12.1% industry...',  0,   'success', NOW()-INTERVAL '90 minutes')
      `);
    }

    const { rows: aRows } = await client.query('SELECT COUNT(*) FROM aops_alerts');
    if (parseInt(aRows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO aops_alerts (metric, threshold, operator, is_active) VALUES
        ('latency_ms',    5000,  '>',  TRUE),
        ('cost_usd_day',  10.00, '>',  TRUE)
      `);
    }
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureTables();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const [runs, traces, alerts] = await Promise.all([
      client.query('SELECT * FROM aops_runs ORDER BY started_at DESC'),
      client.query('SELECT * FROM aops_traces ORDER BY run_id, step_number'),
      client.query('SELECT * FROM aops_alerts ORDER BY id'),
    ]);

    const { rows: costRows } = await client.query(`
      SELECT
        COALESCE(SUM(cost_usd) FILTER (WHERE started_at >= CURRENT_DATE), 0) AS today,
        COALESCE(SUM(cost_usd) FILTER (WHERE started_at >= date_trunc('month', NOW())), 0) AS month_to_date,
        model_used,
        COALESCE(SUM(cost_usd), 0) AS model_cost
      FROM aops_runs
      WHERE cost_usd IS NOT NULL
      GROUP BY GROUPING SETS ((), (model_used))
    `);

    const today = costRows.find(r => !r.model_used)?.today || '0';
    const mtd = costRows.find(r => !r.model_used)?.month_to_date || '0';
    const byModel = costRows.filter(r => r.model_used).map(r => ({ model: r.model_used, cost: r.model_cost }));

    return Response.json({
      runs: runs.rows,
      traces: traces.rows,
      alerts: alerts.rows,
      cost_summary: { today: parseFloat(today), month_to_date: parseFloat(mtd), by_model: byModel },
    });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureTables();
  const body = await req.json().catch(() => null) as {
    action?: string;
    agent_name?: string; model_used?: string; input_text?: string;
    metric?: string; threshold?: number; operator?: string;
  } | null;

  if (!body?.action) return Response.json({ error: 'action required' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    if (body.action === 'new_run') {
      const runId = `run-${Date.now()}`;
      const { rows } = await client.query(
        `INSERT INTO aops_runs (run_id, agent_name, model_used, status, input_text, started_at)
         VALUES ($1, $2, $3, 'running', $4, NOW()) RETURNING *`,
        [runId, body.agent_name || 'Unknown Agent', body.model_used || 'gpt-4o', body.input_text || ''],
      );
      return Response.json({ run: rows[0] }, { status: 201 });
    } else if (body.action === 'new_alert') {
      if (!body.metric || body.threshold === undefined) {
        return Response.json({ error: 'metric and threshold required' }, { status: 400 });
      }
      const { rows } = await client.query(
        `INSERT INTO aops_alerts (metric, threshold, operator, is_active)
         VALUES ($1, $2, $3, TRUE) RETURNING *`,
        [body.metric, body.threshold, body.operator || '>'],
      );
      return Response.json({ alert: rows[0] }, { status: 201 });
    }
    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureTables();
  const body = await req.json().catch(() => null) as { entity?: string; id?: string | number; status?: string; is_active?: boolean } | null;
  if (!body?.entity || !body?.id) return Response.json({ error: 'entity and id required' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    if (body.entity === 'run') {
      await client.query(
        `UPDATE aops_runs SET status = $1, completed_at = NOW() WHERE run_id = $2`,
        [body.status || 'success', body.id],
      );
    } else if (body.entity === 'alert') {
      await client.query(
        `UPDATE aops_alerts SET is_active = $1 WHERE id = $2`,
        [body.is_active !== false, body.id],
      );
    } else {
      return Response.json({ error: 'entity must be run or alert' }, { status: 400 });
    }
    return Response.json({ ok: true });
  } finally {
    client.release();
  }
}
