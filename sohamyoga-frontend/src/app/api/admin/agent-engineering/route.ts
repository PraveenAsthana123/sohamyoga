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
      CREATE TABLE IF NOT EXISTS ae_agents (
        agent_id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        description TEXT,
        agent_type VARCHAR(32) NOT NULL,
        base_model VARCHAR(64),
        tools TEXT[],
        max_iterations INT NOT NULL DEFAULT 5,
        system_prompt TEXT,
        status VARCHAR(16) NOT NULL DEFAULT 'draft',
        version VARCHAR(16) NOT NULL DEFAULT '1.0.0',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ae_blueprints (
        blueprint_id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        description TEXT,
        agent_type VARCHAR(32) NOT NULL,
        base_model VARCHAR(64),
        tools TEXT[],
        is_deployed BOOLEAN NOT NULL DEFAULT FALSE
      );

      CREATE TABLE IF NOT EXISTS ae_evaluations (
        id SERIAL PRIMARY KEY,
        agent_id VARCHAR(64) NOT NULL,
        eval_dataset VARCHAR(16) NOT NULL,
        metric VARCHAR(32) NOT NULL,
        score NUMERIC(5,2),
        test_cases_run INT,
        passed INT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ae_deployments (
        id SERIAL PRIMARY KEY,
        agent_id VARCHAR(64) NOT NULL,
        version VARCHAR(16) NOT NULL,
        environment VARCHAR(16) NOT NULL,
        deployed_by VARCHAR(64),
        status VARCHAR(16) NOT NULL DEFAULT 'success',
        deployed_at TIMESTAMP DEFAULT NOW()
      );
    `);

    const { rows: agRows } = await client.query('SELECT COUNT(*) FROM ae_agents');
    if (parseInt(agRows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO ae_agents (agent_id, name, description, agent_type, base_model, tools, max_iterations, system_prompt, status, version) VALUES
        ('ag-001', 'Marketing Agent',       'Generates ad copy, blog posts, and social media content',   'ReAct',          'gpt-4o',       ARRAY['web_search','file_read','api_call'], 8,  'You are an expert digital marketing copywriter...', 'production', '2.1.0'),
        ('ag-002', 'Analytics Agent',       'Queries databases, builds reports, interprets KPI data',    'Chain',          'claude-3-5',   ARRAY['db_query','code_exec','api_call'],   6,  'You are a data analyst. Always show your work..',  'production', '1.3.0'),
        ('ag-003', 'Social Media Agent',    'Schedules posts, monitors engagement, responds to DMs',     'Plan&Execute',   'llama3.1',     ARRAY['api_call','web_search','email'],     10, 'You manage social media for a yoga brand...',     'testing',    '0.9.0'),
        ('ag-004', 'Customer Support Agent','Handles enquiries, processes refunds, escalates issues',    'Tool-Use',       'mixtral-8x7b', ARRAY['db_query','email','api_call'],       5,  'You are a friendly customer support agent...',    'production', '3.0.1'),
        ('ag-005', 'Content Writer Agent',  'Creates long-form content, newsletters, and landing pages', 'RAG',            'gpt-4o',       ARRAY['file_read','web_search','db_query'], 7,  'You are a skilled content writer with RAG...',    'testing',    '1.0.2'),
        ('ag-006', 'Data Pipeline Agent',   'Ingests, transforms, and loads data from various sources',  'Custom',         'claude-3-5',   ARRAY['db_query','code_exec','file_read'],  12, 'You orchestrate ETL pipelines...',                'draft',      '0.3.0')
      `);
    }

    const { rows: bpRows } = await client.query('SELECT COUNT(*) FROM ae_blueprints');
    if (parseInt(bpRows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO ae_blueprints (blueprint_id, name, description, agent_type, base_model, tools, is_deployed) VALUES
        ('bp-001', 'Marketing Agent',         'Ready-to-deploy marketing automation agent for ad copy and content', 'ReAct',        'gpt-4o',       ARRAY['web_search','file_read','api_call'],          TRUE),
        ('bp-002', 'Analytics Agent',         'Pre-built analytics agent with database query and reporting tools',  'Chain',        'claude-3-5',   ARRAY['db_query','code_exec','api_call'],            TRUE),
        ('bp-003', 'Social Media Agent',      'Multi-platform social media scheduling and engagement agent',        'Plan&Execute', 'llama3.1',     ARRAY['api_call','web_search'],                      FALSE),
        ('bp-004', 'Customer Support Agent',  'Ticket handling, refund processing, and escalation routing agent',   'Tool-Use',     'mixtral-8x7b', ARRAY['db_query','email','api_call'],                TRUE),
        ('bp-005', 'Content Writer Agent',    'RAG-powered long-form content generator for blogs and newsletters',  'RAG',          'gpt-4o',       ARRAY['file_read','web_search','db_query'],          FALSE),
        ('bp-006', 'Data Pipeline Agent',     'Automated ETL agent for ingestion, transformation, and loading',    'Custom',       'claude-3-5',   ARRAY['db_query','code_exec','file_read','api_call'], FALSE)
      `);
    }

    const { rows: evRows } = await client.query('SELECT COUNT(*) FROM ae_evaluations');
    if (parseInt(evRows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO ae_evaluations (agent_id, eval_dataset, metric, score, test_cases_run, passed, created_at) VALUES
        ('ag-001', 'medium', 'accuracy',     88.50, 40, 35, NOW()-INTERVAL '3 days'),
        ('ag-002', 'large',  'faithfulness', 91.20, 80, 73, NOW()-INTERVAL '2 days'),
        ('ag-004', 'small',  'relevance',    94.00, 20, 19, NOW()-INTERVAL '1 day'),
        ('ag-005', 'medium', 'completeness', 76.80, 40, 31, NOW()-INTERVAL '12 hours')
      `);
    }

    const { rows: dpRows } = await client.query('SELECT COUNT(*) FROM ae_deployments');
    if (parseInt(dpRows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO ae_deployments (agent_id, version, environment, deployed_by, status, deployed_at) VALUES
        ('ag-001', '2.1.0', 'prod',    'admin@sohamyoga.ca', 'success', NOW()-INTERVAL '1 day'),
        ('ag-001', '2.0.0', 'staging', 'admin@sohamyoga.ca', 'success', NOW()-INTERVAL '3 days'),
        ('ag-002', '1.3.0', 'prod',    'admin@sohamyoga.ca', 'success', NOW()-INTERVAL '2 days'),
        ('ag-004', '3.0.1', 'prod',    'admin@sohamyoga.ca', 'success', NOW()-INTERVAL '5 hours'),
        ('ag-003', '0.9.0', 'dev',     'admin@sohamyoga.ca', 'success', NOW()-INTERVAL '6 hours')
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
    const [agents, blueprints, evaluations, deployments] = await Promise.all([
      client.query('SELECT * FROM ae_agents ORDER BY created_at DESC'),
      client.query('SELECT * FROM ae_blueprints ORDER BY name'),
      client.query('SELECT * FROM ae_evaluations ORDER BY created_at DESC'),
      client.query('SELECT * FROM ae_deployments ORDER BY deployed_at DESC'),
    ]);
    return Response.json({
      agents: agents.rows,
      blueprints: blueprints.rows,
      evaluations: evaluations.rows,
      deployments: deployments.rows,
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
    name?: string; description?: string; agent_type?: string; base_model?: string;
    tools?: string[]; max_iterations?: number; system_prompt?: string;
    blueprint_id?: string; environment?: string;
  } | null;

  if (!body?.action) return Response.json({ error: 'action required' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    if (body.action === 'create_agent') {
      if (!body.name || !body.agent_type) {
        return Response.json({ error: 'name and agent_type required' }, { status: 400 });
      }
      const agentId = `ag-${Date.now()}`;
      const { rows } = await client.query(
        `INSERT INTO ae_agents (agent_id, name, description, agent_type, base_model, tools, max_iterations, system_prompt, status, version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft','1.0.0') RETURNING *`,
        [agentId, body.name, body.description || '', body.agent_type, body.base_model || 'gpt-4o',
          body.tools || [], body.max_iterations || 5, body.system_prompt || ''],
      );
      return Response.json({ agent: rows[0] }, { status: 201 });
    } else if (body.action === 'deploy_blueprint') {
      if (!body.blueprint_id) return Response.json({ error: 'blueprint_id required' }, { status: 400 });
      const { rows: bpRows } = await client.query('SELECT * FROM ae_blueprints WHERE blueprint_id = $1', [body.blueprint_id]);
      if (!bpRows[0]) return Response.json({ error: 'Blueprint not found' }, { status: 404 });
      const bp = bpRows[0];
      const agentId = `ag-${Date.now()}`;
      const { rows: agRows } = await client.query(
        `INSERT INTO ae_agents (agent_id, name, description, agent_type, base_model, tools, max_iterations, system_prompt, status, version)
         VALUES ($1,$2,$3,$4,$5,$6,5,'Deployed from blueprint $7','production','1.0.0') RETURNING *`,
        [agentId, bp.name, bp.description || '', bp.agent_type, bp.base_model, bp.tools, bp.blueprint_id],
      );
      await client.query(
        `INSERT INTO ae_deployments (agent_id, version, environment, deployed_by, status) VALUES ($1,'1.0.0',$2,'admin','success')`,
        [agentId, body.environment || 'prod'],
      );
      await client.query('UPDATE ae_blueprints SET is_deployed = TRUE WHERE blueprint_id = $1', [body.blueprint_id]);
      return Response.json({ agent: agRows[0] }, { status: 201 });
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
  const body = await req.json().catch(() => null) as { agent_id?: string; status?: string } | null;
  if (!body?.agent_id || !body?.status) {
    return Response.json({ error: 'agent_id and status required' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('UPDATE ae_agents SET status = $1 WHERE agent_id = $2', [body.status, body.agent_id]);
    return Response.json({ ok: true });
  } finally {
    client.release();
  }
}
