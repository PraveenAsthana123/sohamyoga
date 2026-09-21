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
      CREATE TABLE IF NOT EXISTS mat_swarms (
        swarm_id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        goal TEXT NOT NULL,
        agents_count INT NOT NULL DEFAULT 0,
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        coordinator_agent VARCHAR(64),
        progress_pct INT NOT NULL DEFAULT 0,
        started_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS mat_messages (
        id SERIAL PRIMARY KEY,
        msg_id VARCHAR(64) NOT NULL,
        from_agent VARCHAR(64) NOT NULL,
        to_agent VARCHAR(64) NOT NULL,
        message_type VARCHAR(32) NOT NULL,
        payload_preview VARCHAR(200),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS mat_consensus (
        decision_id VARCHAR(64) PRIMARY KEY,
        swarm_id VARCHAR(64) NOT NULL,
        question TEXT NOT NULL,
        votes_for INT NOT NULL DEFAULT 0,
        votes_against INT NOT NULL DEFAULT 0,
        result VARCHAR(64),
        decided_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS mat_strategies (
        strategy_id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(64) NOT NULL,
        description TEXT NOT NULL,
        is_default BOOLEAN NOT NULL DEFAULT false,
        agent_count INT NOT NULL DEFAULT 0
      );
    `);

    const { rows: sw } = await client.query('SELECT COUNT(*) FROM mat_swarms');
    if (parseInt(sw[0].count) === 0) {
      const swarms = [
        ['swm-content', 'Content Creation Swarm', 'Autonomously research, draft, review and publish 20 blog posts per week across all verticals', 5, 'active', 'agent-planner-01', 72],
        ['swm-market', 'Market Research Swarm', 'Continuously monitor competitor pricing, social sentiment and keyword trends across 9 verticals', 8, 'active', 'agent-analyst-01', 45],
        ['swm-leads', 'Lead Qualification Swarm', 'Score, enrich and route inbound leads from all channels to the appropriate sales funnel stage', 4, 'paused', 'agent-sales-01', 30],
        ['swm-ops', 'DevOps Monitoring Swarm', 'Watch all 10 services, detect anomalies, trigger auto-remediation and escalate P0/P1 incidents', 3, 'completed', 'agent-ops-01', 100],
      ];
      for (const [id, name, goal, cnt, status, coord, pct] of swarms) {
        await client.query(
          'INSERT INTO mat_swarms (swarm_id,name,goal,agents_count,status,coordinator_agent,progress_pct) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [id, name, goal, cnt, status, coord, pct]
        );
      }
    }

    const { rows: msg } = await client.query('SELECT COUNT(*) FROM mat_messages');
    if (parseInt(msg[0].count) === 0) {
      const messages = [
        ['msg-001', 'agent-planner-01', 'agent-writer-01', 'task', 'Write blog post outline on "Top 10 Yoga Poses for Beginners" targeting keyword rank #1'],
        ['msg-002', 'agent-writer-01', 'agent-planner-01', 'result', 'Outline completed: 8 H2 sections, 3200 word target, 5 LSI keywords identified, ready for draft'],
        ['msg-003', 'agent-analyst-01', 'BROADCAST', 'query', 'Requesting latest competitor pricing data from all monitoring agents — urgent SLA update needed'],
        ['msg-004', 'agent-monitor-02', 'agent-analyst-01', 'result', 'Competitor A dropped price by 15% on premium tier — detected via web scrape at 09:42 UTC'],
        ['msg-005', 'agent-planner-01', 'agent-editor-01', 'task', 'Review and SEO-optimize draft post ID=blog-2026-0921-047 before scheduling'],
        ['msg-006', 'agent-sales-01', 'agent-enricher-01', 'query', 'Enrich lead batch #0921: 47 contacts from Google Ads campaign, need company size + tech stack'],
        ['msg-007', 'agent-enricher-01', 'agent-sales-01', 'result', 'Enrichment complete: 41/47 contacts enriched, 6 failed (no public data), avg company size 85 employees'],
        ['msg-008', 'agent-ops-01', 'BROADCAST', 'heartbeat', 'Health check cycle #1482 complete — all 10 services nominal, 0 alerts triggered'],
        ['msg-009', 'agent-writer-02', 'agent-planner-01', 'query', 'Clarification needed: should post about Ashtanga yoga target B2B or B2C audience segment?'],
        ['msg-010', 'agent-planner-01', 'agent-writer-02', 'result', 'Target B2C wellness segment, tone: motivational, include personal story hook in opening'],
        ['msg-011', 'agent-analyst-01', 'agent-monitor-01', 'task', 'Begin tracking social share velocity for 5 top competitor posts published in last 48 hours'],
        ['msg-012', 'agent-monitor-01', 'agent-analyst-01', 'result', 'Tracking initiated. Competitor B post on "yoga for stress" showing 340% above-average velocity'],
        ['msg-013', 'agent-planner-01', 'agent-scheduler-01', 'task', 'Schedule 4 completed posts for optimal publish windows based on audience engagement data'],
        ['msg-014', 'agent-scheduler-01', 'agent-planner-01', 'result', 'Posts scheduled: Mon 7am, Wed 12pm, Fri 8am, Sat 10am UTC — calendar events created'],
        ['msg-015', 'agent-ops-01', 'agent-alert-01', 'vote', 'Proposing auto-scale trigger at CPU > 80% sustained 5min — vote required from coordinator'],
      ];
      for (const [mid, from, to, type, preview] of messages) {
        await client.query(
          'INSERT INTO mat_messages (msg_id,from_agent,to_agent,message_type,payload_preview) VALUES ($1,$2,$3,$4,$5)',
          [mid, from, to, type, preview]
        );
      }
    }

    const { rows: con } = await client.query('SELECT COUNT(*) FROM mat_consensus');
    if (parseInt(con[0].count) === 0) {
      const decisions = [
        ['dec-001', 'swm-content', 'Should we expand content coverage to include Pilates and meditation topics?', 5, 0, 'approved'],
        ['dec-002', 'swm-market', 'Prioritize competitor tracking for yoga vertical over other 8 verticals this week?', 6, 2, 'approved'],
        ['dec-003', 'swm-leads', 'Auto-disqualify leads with company size < 5 employees to reduce noise?', 2, 2, 'tie — escalated'],
        ['dec-004', 'swm-ops', 'Enable auto-restart for cron service on failure without human approval?', 3, 0, 'approved'],
        ['dec-005', 'swm-content', 'Switch primary content model from Llama 3.1 to Claude 3.5 Sonnet for quality?', 3, 2, 'approved'],
      ];
      for (const [id, swarmId, q, vf, va, result] of decisions) {
        await client.query(
          'INSERT INTO mat_consensus (decision_id,swarm_id,question,votes_for,votes_against,result) VALUES ($1,$2,$3,$4,$5,$6)',
          [id, swarmId, q, vf, va, result]
        );
      }
    }

    const { rows: str } = await client.query('SELECT COUNT(*) FROM mat_strategies');
    if (parseInt(str[0].count) === 0) {
      const strategies = [
        ['strat-hier', 'Hierarchical', 'One coordinator agent delegates tasks to sub-agents. All communication flows through the coordinator. Best for structured workflows with clear task decomposition.', true, 5],
        ['strat-flat', 'Flat', 'All agents are peers with equal authority. Decisions made by majority vote. Best for creative tasks where diverse perspectives improve output quality.', false, 4],
        ['strat-hub', 'Hub-and-Spoke', 'A central hub agent manages all external communication. Spoke agents handle specialized subtasks in isolation. Best for security-sensitive workflows.', false, 7],
        ['strat-mesh', 'Mesh', 'Every agent can communicate directly with every other agent. No central coordinator. Highest throughput but complex consensus requirements.', false, 6],
        ['strat-pipe', 'Pipeline', 'Agents arranged in sequential stages. Output of one agent becomes input to the next. Best for multi-stage content or data processing workflows.', false, 3],
      ];
      for (const [id, name, desc, isDefault, cnt] of strategies) {
        await client.query(
          'INSERT INTO mat_strategies (strategy_id,name,description,is_default,agent_count) VALUES ($1,$2,$3,$4,$5)',
          [id, name, desc, isDefault, cnt]
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
    const [swarms, messages, consensus, strategies] = await Promise.all([
      pool.query('SELECT * FROM mat_swarms ORDER BY started_at DESC'),
      pool.query('SELECT * FROM mat_messages ORDER BY created_at DESC LIMIT 15'),
      pool.query('SELECT * FROM mat_consensus ORDER BY decided_at DESC'),
      pool.query('SELECT * FROM mat_strategies ORDER BY name'),
    ]);
    const activeSwarms = swarms.rows.filter((s: { status: string }) => s.status === 'active').length;
    const agentsOnline = swarms.rows.filter((s: { status: string }) => s.status === 'active')
      .reduce((sum: number, s: { agents_count: number }) => sum + s.agents_count, 0);
    const msgPerMin = Math.floor(messages.rows.length / 2);
    const consensusRate = consensus.rows.length
      ? (consensus.rows.filter((d: { result: string }) => d.result === 'approved').length / consensus.rows.length * 100).toFixed(0)
      : '0';
    return NextResponse.json({
      stats: { activeSwarms, agentsOnline, msgPerMin, consensusRate: parseInt(consensusRate) },
      swarms: swarms.rows, messages: messages.rows, consensus: consensus.rows, strategies: strategies.rows,
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
    const body = await req.json() as { swarm_id: string; name: string; goal: string; agents_count: number; coordinator_agent: string };
    const pool = getPool();
    const { rows } = await pool.query(
      'INSERT INTO mat_swarms (swarm_id,name,goal,agents_count,status,coordinator_agent) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [body.swarm_id, body.name, body.goal, body.agents_count, 'active', body.coordinator_agent]
    );
    return NextResponse.json({ swarm: rows[0] }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureTables();
    const body = await req.json() as { swarm_id: string; status: string };
    const pool = getPool();
    const { rows } = await pool.query(
      'UPDATE mat_swarms SET status=$1 WHERE swarm_id=$2 RETURNING *',
      [body.status, body.swarm_id]
    );
    return NextResponse.json({ swarm: rows[0] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
