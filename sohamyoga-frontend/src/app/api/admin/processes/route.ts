export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { getPool } from '@/lib/postgres';
import type { PoolClient } from 'pg';
import { requireAdmin } from '@/lib/admin-auth';

const SEED_PROCESSES = [
  ['Social Media Publishing', 'MKT-001', 'main', null, 'marketing', 'Social Media Team', 'Daily social content publishing workflow'],
  ['Ad Campaign Launch', 'MKT-002', 'main', null, 'marketing', 'Paid Media Team', 'End-to-end paid ad campaign launch process'],
  ['Content Calendar Planning', 'MKT-003', 'main', null, 'marketing', 'Content Team', 'Monthly content planning and scheduling'],
  ['Email Campaign Send', 'MKT-004', 'sub', null, 'marketing', 'Email Team', 'Email campaign creation and dispatch'],
  ['Lead Qualification', 'MKT-005', 'sub', null, 'marketing', 'Marketing Ops', 'Scoring and qualifying inbound leads'],
  ['Lead Nurturing', 'SAL-001', 'main', null, 'sales', 'Sales Team', 'Nurture leads through to conversion'],
  ['Proposal Generation', 'SAL-002', 'sub', null, 'sales', 'Account Exec', 'Create and send client proposals'],
  ['Contract Signing', 'SAL-003', 'sub', null, 'sales', 'Legal', 'Contract review and digital signing'],
  ['Order Fulfillment', 'OPS-001', 'main', null, 'operations', 'Ops Team', 'End-to-end order processing'],
  ['Customer Onboarding', 'OPS-002', 'main', null, 'operations', 'CS Team', 'New customer setup and onboarding'],
  ['Invoice Processing', 'OPS-003', 'sub', null, 'operations', 'Finance', 'Invoice creation and payment tracking'],
  ['Code Deployment', 'TEC-001', 'main', null, 'tech', 'DevOps', 'Production deployment pipeline'],
  ['Security Audit', 'TEC-002', 'sub', null, 'tech', 'Security', 'Quarterly security review process'],
  ['AI Model Evaluation', 'TEC-003', 'sub', null, 'tech', 'AI Team', 'Evaluate and update AI models'],
  ['Video Production', 'CON-001', 'main', null, 'content', 'Video Team', 'Video filming and editing workflow'],
  ['Blog Publishing', 'CON-002', 'sub', null, 'content', 'Content Team', 'Blog article creation and SEO optimization'],
];

async function ensureSchema(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS business_process (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      process_code TEXT UNIQUE,
      process_type TEXT DEFAULT 'main',
      parent_id INTEGER REFERENCES business_process(id) ON DELETE SET NULL,
      department TEXT NOT NULL,
      owner TEXT,
      description TEXT,
      objective TEXT,
      inputs TEXT[],
      outputs TEXT[],
      tools TEXT[],
      status TEXT DEFAULT 'active',
      maturity_level TEXT DEFAULT 'defined',
      automation_level TEXT DEFAULT 'manual',
      frequency TEXT DEFAULT 'daily',
      avg_duration_minutes INTEGER,
      priority TEXT DEFAULT 'medium',
      risk_level TEXT DEFAULT 'low',
      compliance_required BOOLEAN DEFAULT false,
      sop_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  for (const row of SEED_PROCESSES) {
    await client.query(
      `INSERT INTO business_process (name, process_code, process_type, parent_id, department, owner, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (process_code) DO NOTHING`,
      row
    );
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const { searchParams } = new URL(req.url);
  const department = searchParams.get('department');
  const process_type = searchParams.get('process_type');

  const client = await getPool().connect();
  try {
    await ensureSchema(client);

    const whereParts: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (department) { whereParts.push(`p.department = $${idx++}`); params.push(department); }
    if (process_type) { whereParts.push(`p.process_type = $${idx++}`); params.push(process_type); }
    // exclude deprecated by default unless explicitly requested
    if (!searchParams.get('include_deprecated')) {
      whereParts.push(`p.status != 'deprecated'`);
    }

    const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const result = await client.query(`
      SELECT p.*,
        (SELECT COUNT(*) FROM business_process c WHERE c.parent_id = p.id AND c.status != 'deprecated') AS sub_process_count
      FROM business_process p
      ${where}
      ORDER BY p.department, p.process_code
    `, params);

    return Response.json({ processes: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const body = await req.json() as Record<string, unknown>;
  const { name, process_code, process_type, parent_id, department, owner, description,
    objective, inputs, outputs, tools, frequency, avg_duration_minutes,
    maturity_level, automation_level, priority, risk_level, compliance_required, sop_url } = body;

  if (!name || !department) {
    return Response.json({ error: 'name and department are required' }, { status: 400 });
  }

  const client = await getPool().connect();
  try {
    await ensureSchema(client);
    const result = await client.query(`
      INSERT INTO business_process
        (name, process_code, process_type, parent_id, department, owner, description,
         objective, inputs, outputs, tools, frequency, avg_duration_minutes,
         maturity_level, automation_level, priority, risk_level, compliance_required, sop_url)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      RETURNING *
    `, [name, process_code || null, process_type || 'main', parent_id || null, department,
        owner || null, description || null, objective || null,
        inputs || null, outputs || null, tools || null,
        frequency || 'daily', avg_duration_minutes || null,
        maturity_level || 'defined', automation_level || 'manual',
        priority || 'medium', risk_level || 'low',
        compliance_required || false, sop_url || null]);
    return Response.json({ process: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const body = await req.json() as Record<string, unknown>;
  const { id, ...fields } = body;
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });

  const allowed = ['name', 'process_code', 'process_type', 'parent_id', 'department', 'owner',
    'description', 'objective', 'inputs', 'outputs', 'tools', 'status', 'maturity_level',
    'automation_level', 'frequency', 'avg_duration_minutes', 'priority', 'risk_level',
    'compliance_required', 'sop_url'];

  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  for (const [k, v] of Object.entries(fields)) {
    if (allowed.includes(k)) {
      sets.push(`${k} = $${idx++}`);
      params.push(v);
    }
  }

  if (!sets.length) return Response.json({ error: 'No valid fields to update' }, { status: 400 });
  params.push(id);

  const client = await getPool().connect();
  try {
    const result = await client.query(
      `UPDATE business_process SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    if (!result.rowCount) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ process: result.rows[0] });
  } finally {
    client.release();
  }
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });

  const client = await getPool().connect();
  try {
    const result = await client.query(
      `UPDATE business_process SET status = 'deprecated' WHERE id = $1 RETURNING id`,
      [id]
    );
    if (!result.rowCount) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ success: true });
  } finally {
    client.release();
  }
}
