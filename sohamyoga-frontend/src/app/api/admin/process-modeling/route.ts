export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

async function provision(client: import('pg').PoolClient) {
  await client.query(`CREATE TABLE IF NOT EXISTS process_models (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'BPMN',
    department TEXT,
    version TEXT DEFAULT '1.0',
    description TEXT,
    xml_definition TEXT,
    swimlanes JSONB,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS decision_tables (
    id SERIAL PRIMARY KEY,
    process_id INTEGER,
    name TEXT,
    conditions JSONB,
    rules JSONB,
    output_type TEXT DEFAULT 'text',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS process_stakeholders (
    id SERIAL PRIMARY KEY,
    process_id INTEGER,
    name TEXT,
    role TEXT,
    lane TEXT,
    responsibilities TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
}

async function seed(client: import('pg').PoolClient) {
  const { rowCount } = await client.query('SELECT 1 FROM process_models LIMIT 1');
  if (rowCount && rowCount > 0) return;
  await client.query(`INSERT INTO process_models (name,type,department,version,description,status) VALUES
    ('Customer Onboarding','BPMN','Sales','1.0','End-to-end customer onboarding from lead to active account','active'),
    ('Invoice Approval','BPMN','Finance','2.1','Multi-level invoice approval workflow with thresholds','active'),
    ('Marketing Campaign Approval','Swimlane','Marketing','1.2','Cross-department campaign sign-off process','draft'),
    ('Content Publication Flow','Swimlane','Content','1.0','Content review, approval, and publication pipeline','active'),
    ('Lead Qualification Decision','Decision','Sales','1.0','Decision table for lead scoring and routing','active')`);
  await client.query(`INSERT INTO decision_tables (process_id,name,conditions,rules,output_type) VALUES
    (5,'Lead Score Routing','[{"field":"score","operator":">=","value":80}]','[{"conditions":[true],"output":"Hot Lead - Immediate Call"}]','text'),
    (2,'Invoice Threshold','[{"field":"amount","operator":">","value":10000}]','[{"conditions":[true],"output":"VP Approval Required"}]','text'),
    (1,'Customer Segment','[{"field":"revenue","operator":">","value":50000}]','[{"conditions":[true],"output":"Enterprise Track"}]','text')`);
  await client.query(`INSERT INTO process_stakeholders (process_id,name,role,lane,responsibilities) VALUES
    (1,'Sales Rep','Initiator','Sales','Create lead,Collect info,Submit request'),
    (1,'Account Manager','Owner','Customer Success','Verify docs,Setup account,Onboard customer'),
    (2,'Finance Analyst','Reviewer','Finance','Review invoice,Check budget,Route for approval'),
    (2,'VP Finance','Approver','Executive','Approve high-value invoices,Sign off'),
    (3,'Brand Manager','Coordinator','Marketing','Review content,Approve messaging'),
    (3,'Legal Counsel','Reviewer','Legal','Check compliance,Flag risks')`);
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
    const type = url.searchParams.get('type');
    const where = type ? `WHERE type=$1` : '';
    const params = type ? [type] : [];
    const models = await client.query(`SELECT * FROM process_models ${where} ORDER BY created_at DESC`, params);
    return Response.json({ models: models.rows });
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
      `INSERT INTO process_models (name,type,department,version,description,xml_definition,swimlanes,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [body.name, body.type || 'BPMN', body.department || null, body.version || '1.0',
       body.description || null, body.xml_definition || null,
       body.swimlanes ? JSON.stringify(body.swimlanes) : null, body.status || 'draft']
    );
    return Response.json({ model: r.rows[0] }, { status: 201 });
  } finally { client.release(); }
}
