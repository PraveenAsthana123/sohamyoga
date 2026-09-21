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
      CREATE TABLE IF NOT EXISTS alc_agents (
        agent_id        VARCHAR(64) PRIMARY KEY,
        name            VARCHAR(128) NOT NULL,
        lifecycle_stage VARCHAR(32)  NOT NULL DEFAULT 'Prototype',
        days_in_stage   INT          NOT NULL DEFAULT 0,
        next_transition VARCHAR(64),
        owner           VARCHAR(128),
        created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS alc_versions (
        id            SERIAL PRIMARY KEY,
        agent_id      VARCHAR(64) NOT NULL,
        version       VARCHAR(32) NOT NULL,
        release_date  TIMESTAMP   NOT NULL DEFAULT NOW(),
        changes_summary TEXT,
        status        VARCHAR(32) NOT NULL DEFAULT 'active'
      );
      CREATE TABLE IF NOT EXISTS alc_health_checks (
        id             SERIAL PRIMARY KEY,
        agent_id       VARCHAR(64) NOT NULL,
        agent_name     VARCHAR(128),
        check_type     VARCHAR(32) NOT NULL DEFAULT 'smoke',
        last_run       TIMESTAMP   NOT NULL DEFAULT NOW(),
        result         VARCHAR(16) NOT NULL DEFAULT 'pass',
        next_scheduled TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS alc_retirement (
        id              SERIAL PRIMARY KEY,
        agent_id        VARCHAR(64) NOT NULL,
        agent_name      VARCHAR(128),
        reason          TEXT,
        flagged_by      VARCHAR(128),
        flagged_at      TIMESTAMP   NOT NULL DEFAULT NOW(),
        retirement_date TIMESTAMP,
        status          VARCHAR(32) NOT NULL DEFAULT 'pending'
      );
      CREATE TABLE IF NOT EXISTS alc_changelog (
        id          SERIAL PRIMARY KEY,
        agent_id    VARCHAR(64),
        agent_name  VARCHAR(128),
        change_type VARCHAR(32) NOT NULL DEFAULT 'update',
        description TEXT,
        author      VARCHAR(128),
        changed_at  TIMESTAMP   NOT NULL DEFAULT NOW()
      );
    `);

    const { rows: agentRows } = await client.query('SELECT COUNT(*) FROM alc_agents');
    if (parseInt(agentRows[0].count) === 0) {
      const agents: [string,string,string,number,string,string][] = [
        ['agt-001','Content Research Agent', 'Production',   45,'Maintenance in 60 days','Sarah K.'],
        ['agt-002','SEO Optimizer Agent',    'Production',   12,'Annual review in 90 days','Dev Team'],
        ['agt-003','FAQ Knowledge Agent',    'Production',   88,'Upgrade evaluation pending','Sarah K.'],
        ['agt-004','Lead Scoring Agent',     'Staging',       7,'Promote to Production','Dev Team'],
        ['agt-005','Content Quality Critic', 'Maintenance',  30,'Return to Production','Alex R.'],
        ['agt-006','Campaign Planner Agent', 'Testing',       3,'Move to Staging','Dev Team'],
        ['agt-007','Social Publisher Agent', 'Deprecated',  120,'Retire in 14 days','Alex R.'],
        ['agt-008','Email Dispatch Agent',   'Prototype',     2,'Design review complete','Dev Team'],
      ];
      for (const [agent_id, name, lifecycle_stage, days_in_stage, next_transition, owner] of agents) {
        await client.query(
          `INSERT INTO alc_agents (agent_id,name,lifecycle_stage,days_in_stage,next_transition,owner)
           VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
          [agent_id, name, lifecycle_stage, days_in_stage, next_transition, owner]
        );
      }
    }

    const { rows: vRows } = await client.query('SELECT COUNT(*) FROM alc_versions');
    if (parseInt(vRows[0].count) === 0) {
      const versions: [string,string,string,string][] = [
        ['agt-001','v2.3','Added multi-source web search, improved citation accuracy by 23%','active'],
        ['agt-001','v2.2','Fixed timeout bug on large document processing, added retry logic','archived'],
        ['agt-001','v2.1','Initial production release after 3 weeks staging validation','archived'],
        ['agt-002','v1.8','Integrated semantic keyword clustering, 18% better SERP prediction','active'],
        ['agt-002','v1.7','Bug fix: null pointer on empty keyword list','archived'],
        ['agt-003','v3.1','RAG pipeline upgrade: HNSW index, reduced p99 latency from 420ms to 95ms','active'],
        ['agt-003','v3.0','Switched embedding model to nomic-embed-text for cost reduction','archived'],
        ['agt-003','v2.9','Added document freshness scoring and stale document flagging','archived'],
      ];
      for (const [agent_id, version, changes_summary, status] of versions) {
        await client.query(
          `INSERT INTO alc_versions (agent_id,version,changes_summary,status)
           VALUES ($1,$2,$3,$4)`,
          [agent_id, version, changes_summary, status]
        );
      }
    }

    const { rows: hcRows } = await client.query('SELECT COUNT(*) FROM alc_health_checks');
    if (parseInt(hcRows[0].count) === 0) {
      const checks: [string,string,string,string][] = [
        ['agt-001','Content Research Agent', 'smoke',       'pass'],
        ['agt-001','Content Research Agent', 'integration', 'pass'],
        ['agt-002','SEO Optimizer Agent',    'smoke',       'pass'],
        ['agt-002','SEO Optimizer Agent',    'regression',  'warning'],
        ['agt-003','FAQ Knowledge Agent',    'smoke',       'pass'],
        ['agt-003','FAQ Knowledge Agent',    'load',        'pass'],
        ['agt-004','Lead Scoring Agent',     'smoke',       'pass'],
        ['agt-004','Lead Scoring Agent',     'integration', 'fail'],
        ['agt-005','Content Quality Critic', 'smoke',       'pass'],
        ['agt-007','Social Publisher Agent', 'smoke',       'fail'],
      ];
      for (const [agent_id, agent_name, check_type, result] of checks) {
        await client.query(
          `INSERT INTO alc_health_checks (agent_id,agent_name,check_type,result,next_scheduled)
           VALUES ($1,$2,$3,$4, NOW() + interval '24 hours')`,
          [agent_id, agent_name, check_type, result]
        );
      }
    }

    const { rows: rtRows } = await client.query('SELECT COUNT(*) FROM alc_retirement');
    if (parseInt(rtRows[0].count) === 0) {
      await client.query(
        `INSERT INTO alc_retirement (agent_id,agent_name,reason,flagged_by,retirement_date,status)
         VALUES ($1,$2,$3,$4, NOW() + interval '14 days', 'pending'),
                ($5,$6,$7,$8, NOW() + interval '7 days',  'pending')`,
        [
          'agt-007','Social Publisher Agent',
          'Replaced by Social Publisher Agent v5.0 with OAuth 2.0 multi-platform support','Alex R.',
          'agt-003','FAQ Knowledge Agent',
          'Upgrading to vector-first architecture; current version to be retired after v4.0 validated','Sarah K.',
        ]
      );
    }

    const { rows: clRows } = await client.query('SELECT COUNT(*) FROM alc_changelog');
    if (parseInt(clRows[0].count) === 0) {
      const changes: [string,string,string,string,string][] = [
        ['agt-001','Content Research Agent','upgrade',   'Deployed v2.3: multi-source search + citation accuracy improvements','CI/CD Pipeline'],
        ['agt-002','SEO Optimizer Agent',   'update',    'Config change: max_tokens 2048→4096 for long-tail keyword analysis','Sarah K.'],
        ['agt-003','FAQ Knowledge Agent',   'upgrade',   'Deployed v3.1: HNSW index migration complete, latency -77%','Dev Team'],
        ['agt-004','Lead Scoring Agent',    'stage_move','Promoted from Testing to Staging after 72-hour validation pass','Alex R.'],
        ['agt-005','Content Quality Critic','stage_move','Moved to Maintenance: prompt revision cycle initiated by product team','Sarah K.'],
        ['agt-006','Campaign Planner Agent','created',   'New agent spawned from Planner Agent Template v1.0','Dev Team'],
        ['agt-007','Social Publisher Agent','deprecated','Marked deprecated: v5.0 now handles all channels with better rate limiting','Alex R.'],
        ['agt-008','Email Dispatch Agent',  'created',   'Prototype created from Executor Template for Brevo integration testing','Dev Team'],
        ['agt-001','Content Research Agent','health',    'Regression test suite added: 45 test cases covering all tool call paths','CI/CD Pipeline'],
        ['agt-003','FAQ Knowledge Agent',   'retirement','Added to retirement queue: v4.0 vector-first architecture in testing','Sarah K.'],
      ];
      for (const [agent_id, agent_name, change_type, description, author] of changes) {
        await client.query(
          `INSERT INTO alc_changelog (agent_id,agent_name,change_type,description,author)
           VALUES ($1,$2,$3,$4,$5)`,
          [agent_id, agent_name, change_type, description, author]
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
    const [agents, versions, healthChecks, retirement, changelog] = await Promise.all([
      pool.query('SELECT * FROM alc_agents ORDER BY name'),
      pool.query('SELECT * FROM alc_versions ORDER BY release_date DESC'),
      pool.query('SELECT * FROM alc_health_checks ORDER BY last_run DESC'),
      pool.query("SELECT * FROM alc_retirement WHERE status='pending' ORDER BY flagged_at DESC"),
      pool.query('SELECT * FROM alc_changelog ORDER BY changed_at DESC'),
    ]);
    const active = agents.rows.filter((a: { lifecycle_stage: string }) =>
      ['Production','Staging','Testing'].includes(a.lifecycle_stage)).length;
    const deprecated = agents.rows.filter((a: { lifecycle_stage: string }) =>
      ['Deprecated','Retired'].includes(a.lifecycle_stage)).length;
    const avgAge = agents.rows.length
      ? Math.round(agents.rows.reduce((s: number, a: { days_in_stage: number }) => s + a.days_in_stage, 0) / agents.rows.length)
      : 0;
    return NextResponse.json({
      stats: { active, deprecated, avgAgeDays: avgAge, upgradesPending: retirement.rows.length },
      agents: agents.rows, versions: versions.rows, healthChecks: healthChecks.rows,
      retirement: retirement.rows, changelog: changelog.rows,
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
    const body = await req.json() as { agent_id: string; agent_name: string; reason: string; flagged_by: string; retirement_date: string };
    const pool = getPool();
    const { rows } = await pool.query(
      `INSERT INTO alc_retirement (agent_id,agent_name,reason,flagged_by,retirement_date,status)
       VALUES ($1,$2,$3,$4,$5,'pending') RETURNING *`,
      [body.agent_id, body.agent_name, body.reason, body.flagged_by, body.retirement_date]
    );
    return NextResponse.json({ retirement: rows[0] }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureTables();
    const body = await req.json() as { type: string; id?: number; agent_id?: string; stage?: string };
    const pool = getPool();
    if (body.type === 'cancel_retirement') {
      const { rows } = await pool.query(
        "UPDATE alc_retirement SET status='cancelled' WHERE id=$1 RETURNING *",
        [body.id]
      );
      return NextResponse.json({ retirement: rows[0] });
    }
    if (body.type === 'update_stage') {
      const { rows } = await pool.query(
        'UPDATE alc_agents SET lifecycle_stage=$1, days_in_stage=0 WHERE agent_id=$2 RETURNING *',
        [body.stage, body.agent_id]
      );
      return NextResponse.json({ agent: rows[0] });
    }
    return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
