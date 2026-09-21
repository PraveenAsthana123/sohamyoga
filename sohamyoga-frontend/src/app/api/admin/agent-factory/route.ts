export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

async function ensureTables() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS af_templates (
        template_id  VARCHAR(64) PRIMARY KEY,
        name         VARCHAR(128) NOT NULL,
        agent_class  VARCHAR(64)  NOT NULL DEFAULT 'ReAct',
        tools        TEXT,
        base_model   VARCHAR(64)  NOT NULL DEFAULT 'Llama 3.2 70B',
        auto_test    BOOLEAN      NOT NULL DEFAULT TRUE,
        created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS af_build_queue (
        job_id              VARCHAR(64) PRIMARY KEY,
        template_id         VARCHAR(64),
        template_name       VARCHAR(128),
        priority            VARCHAR(16)  NOT NULL DEFAULT 'normal',
        status              VARCHAR(32)  NOT NULL DEFAULT 'queued',
        queued_at           TIMESTAMP    NOT NULL DEFAULT NOW(),
        estimated_completion TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS af_pipeline_stages (
        id           SERIAL PRIMARY KEY,
        job_id       VARCHAR(64)  NOT NULL,
        stage_name   VARCHAR(64)  NOT NULL,
        status       VARCHAR(32)  NOT NULL DEFAULT 'pending',
        duration_s   INT,
        log_snippet  TEXT,
        started_at   TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS af_registry (
        agent_id     VARCHAR(64) PRIMARY KEY,
        name         VARCHAR(128) NOT NULL,
        version      VARCHAR(32)  NOT NULL DEFAULT 'v1.0',
        build_number INT          NOT NULL DEFAULT 1,
        template_id  VARCHAR(64),
        template_name VARCHAR(128),
        deployed_to  VARCHAR(64),
        built_at     TIMESTAMP    NOT NULL DEFAULT NOW()
      );
    `);

    const { rows: tplRows } = await client.query('SELECT COUNT(*) FROM af_templates');
    if (parseInt(tplRows[0].count) === 0) {
      const templates: [string,string,string,string,string,boolean][] = [
        ['tpl-react',   'ReAct Agent Template',       'ReAct',    'web_search,calculator,code_runner',       'Llama 3.2 70B',    true],
        ['tpl-rag',     'RAG Agent Template',          'RAG',      'vector_search,document_reader,summarize', 'nomic-embed-text', true],
        ['tpl-tooluse', 'Tool-Use Agent Template',     'Tool-Use', 'api_caller,json_parser,db_query',         'GPT-4o',           true],
        ['tpl-critic',  'Critic Agent Template',       'Critic',   'fact_check,score_quality,flag_issues',    'Claude 3.5 Sonnet',true],
        ['tpl-planner', 'Planner Agent Template',      'Planner',  'task_decompose,assign_agents,schedule',   'Claude 3.5 Sonnet',false],
        ['tpl-exec',    'Executor Agent Template',     'Executor', 'run_script,call_api,write_file,notify',   'Mistral 7B',       true],
      ];
      for (const [template_id, name, agent_class, tools, base_model, auto_test] of templates) {
        await client.query(
          `INSERT INTO af_templates (template_id,name,agent_class,tools,base_model,auto_test)
           VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
          [template_id, name, agent_class, tools, base_model, auto_test]
        );
      }
    }

    const { rows: jqRows } = await client.query('SELECT COUNT(*) FROM af_build_queue');
    if (parseInt(jqRows[0].count) === 0) {
      const jobs: [string,string,string,string,string][] = [
        ['job-001','tpl-react',  'ReAct Agent Template',   'high',   'running'],
        ['job-002','tpl-rag',    'RAG Agent Template',     'normal', 'queued'],
        ['job-003','tpl-critic', 'Critic Agent Template',  'normal', 'queued'],
        ['job-004','tpl-planner','Planner Agent Template', 'low',    'queued'],
      ];
      for (const [job_id, template_id, template_name, priority, status] of jobs) {
        await client.query(
          `INSERT INTO af_build_queue (job_id,template_id,template_name,priority,status,estimated_completion)
           VALUES ($1,$2,$3,$4,$5, NOW() + interval '10 minutes') ON CONFLICT DO NOTHING`,
          [job_id, template_id, template_name, priority, status]
        );
      }
    }

    const { rows: psRows } = await client.query('SELECT COUNT(*) FROM af_pipeline_stages');
    if (parseInt(psRows[0].count) === 0) {
      const stages: [string,string,string,number|null,string|null][] = [
        ['job-001','Design',    'passed',  12,   'Schema validated, tool registry resolved, dependency graph built'],
        ['job-001','Configure', 'passed',  8,    'Model bindings set: Llama 3.2 70B, tools: web_search, calculator, code_runner'],
        ['job-001','Test',      'running', null, 'Running smoke tests: tool_call_basic (pass), tool_call_chain (running)...'],
        ['job-001','Package',   'pending', null, null],
        ['job-001','Deploy',    'pending', null, null],
        ['job-002','Design',    'pending', null, null],
        ['job-002','Configure', 'pending', null, null],
        ['job-002','Test',      'pending', null, null],
        ['job-002','Package',   'pending', null, null],
        ['job-002','Deploy',    'pending', null, null],
      ];
      for (const [job_id, stage_name, status, duration_s, log_snippet] of stages) {
        await client.query(
          `INSERT INTO af_pipeline_stages (job_id,stage_name,status,duration_s,log_snippet)
           VALUES ($1,$2,$3,$4,$5)`,
          [job_id, stage_name, status, duration_s, log_snippet]
        );
      }
    }

    const { rows: regRows } = await client.query('SELECT COUNT(*) FROM af_registry');
    if (parseInt(regRows[0].count) === 0) {
      const registry: [string,string,string,number,string,string,string][] = [
        ['agt-001','Content Research Agent', 'v2.3',3,'tpl-react',  'ReAct Agent Template',   'production'],
        ['agt-002','SEO Optimizer Agent',     'v1.8',8,'tpl-react',  'ReAct Agent Template',   'production'],
        ['agt-003','FAQ Knowledge Agent',     'v3.1',1,'tpl-rag',    'RAG Agent Template',     'production'],
        ['agt-004','Lead Scoring Agent',      'v1.2',2,'tpl-tooluse','Tool-Use Agent Template','staging'],
        ['agt-005','Content Quality Critic',  'v2.0',5,'tpl-critic', 'Critic Agent Template',  'production'],
        ['agt-006','Campaign Planner Agent',  'v1.0',1,'tpl-planner','Planner Agent Template', 'staging'],
        ['agt-007','Social Publisher Agent',  'v4.1',4,'tpl-exec',   'Executor Agent Template','production'],
        ['agt-008','Email Dispatch Agent',    'v2.2',7,'tpl-exec',   'Executor Agent Template','production'],
      ];
      for (const [agent_id, name, version, build_number, template_id, template_name, deployed_to] of registry) {
        await client.query(
          `INSERT INTO af_registry (agent_id,name,version,build_number,template_id,template_name,deployed_to)
           VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
          [agent_id, name, version, build_number, template_id, template_name, deployed_to]
        );
      }
    }
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureTables();
    const pool = getPool();
    const [templates, queue, stages, registry] = await Promise.all([
      pool.query('SELECT * FROM af_templates ORDER BY name'),
      pool.query('SELECT * FROM af_build_queue ORDER BY queued_at'),
      pool.query('SELECT * FROM af_pipeline_stages ORDER BY id'),
      pool.query('SELECT * FROM af_registry ORDER BY built_at DESC'),
    ]);
    const builtThisWeek = registry.rows.filter((r: { built_at: string }) => {
      const d = new Date(r.built_at);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return d > weekAgo;
    }).length;
    const autoDeploy = registry.rows.length
      ? Math.round(registry.rows.filter((r: { deployed_to: string }) => r.deployed_to === 'production').length / registry.rows.length * 100)
      : 0;
    const doneStages = stages.rows.filter((s: { duration_s: number | null }) => s.duration_s !== null);
    const avgBuildTime = doneStages.length
      ? Math.round(doneStages.reduce((sum: number, s: { duration_s: number }) => sum + s.duration_s, 0) / doneStages.length)
      : 0;
    return NextResponse.json({
      stats: { templates: templates.rows.length, builtThisWeek, autoDeployPct: autoDeploy, avgBuildTimeS: avgBuildTime },
      templates: templates.rows, queue: queue.rows, stages: stages.rows, registry: registry.rows,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureTables();
    const body = await req.json() as { template_id: string; template_name: string; priority: string };
    const pool = getPool();
    const job_id = `job-${Date.now()}`;
    const { rows } = await pool.query(
      `INSERT INTO af_build_queue (job_id,template_id,template_name,priority,status,estimated_completion)
       VALUES ($1,$2,$3,$4,'queued', NOW() + interval '15 minutes') RETURNING *`,
      [job_id, body.template_id, body.template_name, body.priority || 'normal']
    );
    return NextResponse.json({ job: rows[0] }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureTables();
    const body = await req.json() as { job_id: string; status: string };
    const pool = getPool();
    const { rows } = await pool.query(
      'UPDATE af_build_queue SET status=$1 WHERE job_id=$2 RETURNING *',
      [body.status, body.job_id]
    );
    return NextResponse.json({ job: rows[0] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
