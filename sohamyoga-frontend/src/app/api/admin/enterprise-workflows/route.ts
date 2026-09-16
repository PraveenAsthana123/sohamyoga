export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

const PROCESS_STAGES: Record<string, string[]> = {
  'Procure-to-Pay': ['Requisition','Vendor Selection','PO Creation','Goods Receipt','Invoice','Payment'],
  'Order-to-Cash': ['Order Received','Credit Check','Fulfillment','Shipping','Invoice','Cash Receipt'],
  'Record-to-Report': ['Data Collection','Journals','Reconciliation','Reporting','Analysis','Close'],
  'Hire-to-Retire': ['Job Posting','Screening','Interview','Offer','Onboarding','Performance','Separation'],
  'Lead-to-Cash': ['Lead','Qualify','Propose','Negotiate','Contract','Deliver','Invoice','Cash'],
  'Issue-to-Resolution': ['Report','Triage','Assign','Investigate','Fix','Test','Close'],
  'Idea-to-Product': ['Ideation','Validation','Design','Build','Test','Launch','Review'],
  'Plan-to-Produce': ['Forecast','Material Plan','Production Order','Manufacturing','QC','Deliver'],
};

async function provision(client: import('pg').PoolClient) {
  await client.query(`CREATE TABLE IF NOT EXISTS enterprise_process_instances (
    id SERIAL PRIMARY KEY,
    process_type TEXT NOT NULL,
    reference_id TEXT,
    entity_name TEXT,
    current_stage TEXT,
    stages_completed JSONB DEFAULT '[]'::jsonb,
    stages_remaining JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'active',
    sla_hours INTEGER DEFAULT 72,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS enterprise_process_events (
    id SERIAL PRIMARY KEY,
    instance_id INTEGER,
    stage TEXT,
    action TEXT,
    actor TEXT,
    notes TEXT,
    occurred_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS enterprise_sla_violations (
    id SERIAL PRIMARY KEY,
    instance_id INTEGER,
    process_type TEXT,
    stage TEXT,
    expected_by TIMESTAMPTZ,
    actual TIMESTAMPTZ,
    hours_overdue NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
}

async function seed(client: import('pg').PoolClient) {
  const { rowCount } = await client.query('SELECT 1 FROM enterprise_process_instances LIMIT 1');
  if (rowCount && rowCount > 0) return;
  const now = new Date();
  const rows: string[] = [];
  const entities: Record<string, string[]> = {
    'Procure-to-Pay': ['Office Supplies PO-2024-001','IT Equipment PO-2024-002'],
    'Order-to-Cash': ['Order SO-5541 Acme Corp','Order SO-5542 Beta Ltd'],
    'Record-to-Report': ['Q3 2024 Close','Q4 2024 Close'],
    'Hire-to-Retire': ['Senior Engineer Role','Marketing Manager Role'],
    'Lead-to-Cash': ['TechCorp Enterprise Deal','StartupCo SMB Deal'],
    'Issue-to-Resolution': ['Server Outage INC-1021','Login Bug INC-1022'],
    'Idea-to-Product': ['Mobile App Feature','Dashboard Redesign'],
    'Plan-to-Produce': ['Production Run PR-441','Production Run PR-442'],
  };
  for (const [processType, stageList] of Object.entries(PROCESS_STAGES)) {
    const entityNames = entities[processType] || [`${processType} Instance A`, `${processType} Instance B`];
    for (let i = 0; i < 2; i++) {
      const stageIdx = Math.floor(Math.random() * (stageList.length - 1));
      const completed = stageList.slice(0, stageIdx);
      const remaining = stageList.slice(stageIdx + 1);
      const current = stageList[stageIdx];
      const startedDaysAgo = Math.floor(Math.random() * 10) + 1;
      const startedAt = new Date(now.getTime() - startedDaysAgo * 24 * 60 * 60 * 1000);
      rows.push(`('${processType}','REF-${Date.now()}-${Math.random().toString(36).slice(2,6)}','${entityNames[i]}','${current}','${JSON.stringify(completed).replace(/'/g,"''")}','${JSON.stringify(remaining).replace(/'/g,"''")}','active',72,'${startedAt.toISOString()}')`);
    }
  }
  if (rows.length) {
    await client.query(`INSERT INTO enterprise_process_instances (process_type,reference_id,entity_name,current_stage,stages_completed,stages_remaining,status,sla_hours,started_at) VALUES ${rows.join(',')}`);
  }
  const instances = await client.query('SELECT id,process_type,current_stage FROM enterprise_process_instances LIMIT 4');
  for (const inst of instances.rows) {
    await client.query(`INSERT INTO enterprise_process_events (instance_id,stage,action,actor,notes) VALUES ($1,$2,'Stage Started','System','Auto-initiated at process start')`,
      [inst.id, inst.current_stage]);
  }
  const vioInsts = instances.rows.slice(0, 4);
  for (const inst of vioInsts) {
    const expected = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const actual = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    await client.query(`INSERT INTO enterprise_sla_violations (instance_id,process_type,stage,expected_by,actual,hours_overdue) VALUES ($1,$2,$3,$4,$5,$6)`,
      [inst.id, inst.process_type, inst.current_stage, expected.toISOString(), actual.toISOString(), 26]);
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    await provision(client);
    await seed(client);
    const url = new URL(req.url);
    const processType = url.searchParams.get('process_type');
    const where = processType ? 'WHERE process_type=$1' : '';
    const params = processType ? [processType] : [];
    const r = await client.query(`SELECT * FROM enterprise_process_instances ${where} ORDER BY started_at DESC`, params);
    return Response.json({ instances: r.rows, process_types: Object.keys(PROCESS_STAGES), stages: PROCESS_STAGES });
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body?.process_type) return Response.json({ error: 'process_type required' }, { status: 400 });
  const stages = PROCESS_STAGES[body.process_type];
  if (!stages) return Response.json({ error: `Invalid process_type. Valid: ${Object.keys(PROCESS_STAGES).join(', ')}` }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    await provision(client);
    const r = await client.query(
      `INSERT INTO enterprise_process_instances (process_type,reference_id,entity_name,current_stage,stages_completed,stages_remaining,status,sla_hours)
       VALUES ($1,$2,$3,$4,$5,$6,'active',$7) RETURNING *`,
      [body.process_type, body.reference_id || `REF-${Date.now()}`,
       body.entity_name || null, stages[0],
       JSON.stringify([]), JSON.stringify(stages.slice(1)), body.sla_hours || 72]
    );
    await client.query(
      `INSERT INTO enterprise_process_events (instance_id,stage,action,actor,notes) VALUES ($1,$2,'Process Started',$3,$4)`,
      [r.rows[0].id, stages[0], body.actor || 'System', body.notes || null]
    );
    return Response.json({ instance: r.rows[0] }, { status: 201 });
  } finally { client.release(); }
}
