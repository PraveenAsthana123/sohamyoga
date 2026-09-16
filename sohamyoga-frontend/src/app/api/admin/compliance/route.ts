import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS compliance_framework (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        category TEXT DEFAULT 'ai',
        description TEXT,
        version TEXT,
        status TEXT DEFAULT 'in_progress',
        compliance_score INTEGER DEFAULT 0,
        total_controls INTEGER DEFAULT 0,
        implemented_controls INTEGER DEFAULT 0,
        last_assessed_at TIMESTAMPTZ,
        next_review_date DATE,
        certification_date DATE,
        certifying_body TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS compliance_control (
        id SERIAL PRIMARY KEY,
        framework_id INTEGER REFERENCES compliance_framework(id) ON DELETE CASCADE,
        control_id TEXT NOT NULL,
        control_name TEXT NOT NULL,
        description TEXT,
        category TEXT,
        status TEXT DEFAULT 'not_started',
        evidence_url TEXT,
        evidence_notes TEXT,
        owner TEXT,
        due_date DATE,
        last_updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(framework_id, control_id)
      )
    `);

    // Seed frameworks
    await client.query(`
      INSERT INTO compliance_framework (code, name, category, description, version, total_controls, implemented_controls)
      VALUES
        ('ISO_42001','ISO/IEC 42001:2023 — AI Management System','ai','International standard for responsible AI management systems','2023',42,12),
        ('ISO_27001','ISO/IEC 27001:2022 — Information Security','security','International standard for information security management','2022',114,45),
        ('GDPR','General Data Protection Regulation','privacy','EU data protection and privacy regulation','2018',99,67),
        ('SOC2','SOC 2 Type II','security','Service Organization Control for SaaS security','2022',64,30),
        ('CCPA','California Consumer Privacy Act','privacy','California data privacy law','2020',28,20),
        ('NIST_AI_RMF','NIST AI Risk Management Framework','ai','US National Institute of Standards AI risk framework','2023',72,18),
        ('PCI_DSS','PCI DSS v4.0','financial','Payment Card Industry Data Security Standard','2022',285,0)
      ON CONFLICT (code) DO NOTHING
    `);

    // Get ISO_42001 framework id
    const fw = await client.query(`SELECT id FROM compliance_framework WHERE code = 'ISO_42001'`);
    if (fw.rowCount && fw.rowCount > 0) {
      const fwId = fw.rows[0].id;
      await client.query(`
        INSERT INTO compliance_control (framework_id, control_id, control_name, category, description, status)
        VALUES
          ($1,'ISO42001-4.1','Understanding the Organization','Context of Organization','Define the organizational context for AI','in_progress'),
          ($1,'ISO42001-4.2','Stakeholder Needs','Context of Organization','Identify needs of interested parties','implemented'),
          ($1,'ISO42001-5.1','Leadership Commitment','Leadership','Top management AI policy commitment','implemented'),
          ($1,'ISO42001-5.2','AI Policy','Leadership','Establish and communicate AI policy','in_progress'),
          ($1,'ISO42001-6.1','AI Risk Assessment','Planning','Identify and assess AI-related risks','in_progress'),
          ($1,'ISO42001-6.2','AI Objectives','Planning','Set measurable AI management objectives','not_started'),
          ($1,'ISO42001-7.1','Resources','Support','Provide necessary resources for AI systems','implemented'),
          ($1,'ISO42001-8.1','Operational Planning','Operation','Plan and control AI operations','in_progress'),
          ($1,'ISO42001-9.1','Performance Monitoring','Performance Evaluation','Monitor AI system performance','not_started'),
          ($1,'ISO42001-10.1','Continual Improvement','Improvement','Improve AI management system continually','not_started')
        ON CONFLICT (framework_id, control_id) DO NOTHING
      `, [fwId]);
    }
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureTables().catch(() => {});

  const client = await pool.connect();
  try {
    const frameworks = await client.query(`
      SELECT f.*,
        CASE WHEN f.total_controls > 0
          THEN ROUND((f.implemented_controls::numeric / f.total_controls) * 100)::int
          ELSE 0
        END AS computed_score
      FROM compliance_framework f
      ORDER BY f.category, f.name
    `).catch(() => ({ rows: [] }));

    return Response.json({ frameworks: frameworks.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureTables().catch(() => {});

  const body = await req.json().catch(() => null);
  if (!body || !body.code || !body.name) {
    return Response.json({ error: 'code and name are required' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(`
      INSERT INTO compliance_framework (code, name, category, description, version, status, total_controls, implemented_controls)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `, [
      body.code, body.name, body.category || 'ai', body.description || null,
      body.version || null, body.status || 'in_progress',
      body.total_controls || 0, body.implemented_controls || 0,
    ]);
    return Response.json({ framework: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (!body || !body.id) {
    return Response.json({ error: 'id is required' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(`
      UPDATE compliance_framework SET
        status = COALESCE($2, status),
        compliance_score = COALESCE($3, compliance_score),
        implemented_controls = COALESCE($4, implemented_controls),
        certification_date = COALESCE($5, certification_date),
        certifying_body = COALESCE($6, certifying_body),
        next_review_date = COALESCE($7, next_review_date),
        last_assessed_at = COALESCE($8, last_assessed_at),
        notes = COALESCE($9, notes)
      WHERE id = $1
      RETURNING *
    `, [
      body.id, body.status || null, body.compliance_score ?? null,
      body.implemented_controls ?? null, body.certification_date || null,
      body.certifying_body || null, body.next_review_date || null,
      body.last_assessed_at || null, body.notes || null,
    ]);
    if (!result.rowCount) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ framework: result.rows[0] });
  } finally {
    client.release();
  }
}
