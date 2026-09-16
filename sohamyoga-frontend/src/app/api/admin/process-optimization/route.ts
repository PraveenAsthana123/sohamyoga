export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

async function provision(client: import('pg').PoolClient) {
  await client.query(`CREATE TABLE IF NOT EXISTS optimization_initiatives (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    methodology TEXT DEFAULT 'Lean',
    process_name TEXT,
    current_metric NUMERIC,
    target_metric NUMERIC,
    unit TEXT,
    status TEXT DEFAULT 'define',
    owner TEXT,
    savings_usd NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS waste_findings (
    id SERIAL PRIMARY KEY,
    process_name TEXT,
    waste_type TEXT,
    description TEXT,
    impact TEXT DEFAULT 'medium',
    estimated_cost_usd NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'identified',
    action_plan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS approval_bottlenecks (
    id SERIAL PRIMARY KEY,
    process_name TEXT,
    step_name TEXT,
    avg_wait_hours NUMERIC DEFAULT 0,
    approver TEXT,
    bypass_eligible BOOLEAN DEFAULT FALSE,
    recommendation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS task_mining_runs (
    id SERIAL PRIMARY KEY,
    process_name TEXT,
    events_analyzed INTEGER DEFAULT 0,
    variants_found INTEGER DEFAULT 0,
    automation_candidates JSONB,
    conformance_score NUMERIC DEFAULT 0,
    run_at TIMESTAMPTZ DEFAULT NOW()
  )`);
}

async function seed(client: import('pg').PoolClient) {
  const { rowCount } = await client.query('SELECT 1 FROM optimization_initiatives LIMIT 1');
  if (rowCount && rowCount > 0) return;
  await client.query(`INSERT INTO optimization_initiatives (name,methodology,process_name,current_metric,target_metric,unit,status,owner,savings_usd) VALUES
    ('Reduce Invoice Cycle Time','Six Sigma','Invoice Processing',14,5,'days','analyze','Finance Team',45000),
    ('Eliminate Manual Data Entry','Lean','Order Management',35,5,'%','improve','Ops Team',28000),
    ('Optimize Approval Chain','Kaizen','Campaign Approval',72,24,'hours','control','Marketing Ops',12000),
    ('Streamline Onboarding','BPR','Customer Onboarding',21,7,'days','define','Sales Ops',60000)`);
  await client.query(`INSERT INTO waste_findings (process_name,waste_type,description,impact,estimated_cost_usd,status,action_plan) VALUES
    ('Order Management','Transport','Documents physically moved between departments','high',8000,'in-progress','Implement digital document routing'),
    ('Inventory Control','Inventory','Excess safety stock held due to poor forecasting','high',25000,'identified','Deploy demand forecasting model'),
    ('Data Entry Process','Motion','Staff walking to printer/scanner for each document','medium',3500,'identified','Install workstation scanners'),
    ('Invoice Processing','Waiting','Invoices waiting 3 days for manager review','high',12000,'in-progress','Set 24hr SLA with escalation'),
    ('Production Planning','Overproduction','Making reports that nobody reads','medium',5000,'identified','Audit report usage, eliminate unused'),
    ('Quality Review','Overprocessing','Triple-checking items that rarely have errors','low',2000,'identified','Reduce to single check with sampling'),
    ('Returns Processing','Defects','10% return rate due to wrong item shipped','high',18000,'in-progress','Barcode verification at pick station'),
    ('Recruiting Process','Skills','HR doing technical screening without domain knowledge','medium',7000,'identified','Involve hiring manager in initial screen')`);
  await client.query(`INSERT INTO approval_bottlenecks (process_name,step_name,avg_wait_hours,approver,bypass_eligible,recommendation) VALUES
    ('Purchase Order','Budget Approval',48,'CFO',false,'Delegate approval to VP for amounts under $5K'),
    ('Campaign Launch','Legal Review',72,'Legal Counsel',false,'Create pre-approved template library for standard campaigns'),
    ('Content Publish','Editorial Sign-off',24,'Editor-in-Chief',true,'Auto-approve if content score > 85 and category is standard'),
    ('Vendor Onboarding','Compliance Check',96,'Compliance Officer',false,'Implement parallel review tracks for low-risk vendors')`);
  await client.query(`INSERT INTO task_mining_runs (process_name,events_analyzed,variants_found,automation_candidates,conformance_score) VALUES
    ('Invoice Processing',15420,23,'[{"task":"Data extraction","confidence":0.92},{"task":"Vendor lookup","confidence":0.87},{"task":"Duplicate check","confidence":0.95}]',78.5),
    ('Order Fulfillment',8930,11,'[{"task":"Inventory check","confidence":0.89},{"task":"Shipping label","confidence":0.94}]',85.2)`);
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
    const methodology = url.searchParams.get('methodology');
    const where = methodology ? 'WHERE methodology=$1' : '';
    const params = methodology ? [methodology] : [];
    const r = await client.query(`SELECT * FROM optimization_initiatives ${where} ORDER BY created_at DESC`, params);
    const [waste, approvals, mining] = await Promise.all([
      client.query('SELECT * FROM waste_findings ORDER BY estimated_cost_usd DESC'),
      client.query('SELECT * FROM approval_bottlenecks ORDER BY avg_wait_hours DESC'),
      client.query('SELECT * FROM task_mining_runs ORDER BY run_at DESC LIMIT 20'),
    ]);
    return Response.json({ initiatives: r.rows, waste: waste.rows, approvals: approvals.rows, mining: mining.rows });
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body?.name) return Response.json({ error: 'name required' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    await provision(client);
    const r = await client.query(
      `INSERT INTO optimization_initiatives (name,methodology,process_name,current_metric,target_metric,unit,status,owner,savings_usd)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [body.name, body.methodology || 'Lean', body.process_name || null,
       body.current_metric || null, body.target_metric || null, body.unit || null,
       body.status || 'define', body.owner || null, body.savings_usd || 0]
    );
    return Response.json({ initiative: r.rows[0] }, { status: 201 });
  } finally { client.release(); }
}
