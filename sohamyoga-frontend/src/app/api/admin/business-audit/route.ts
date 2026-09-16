import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_engagement (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        audit_type TEXT DEFAULT 'internal',
        scope TEXT,
        auditor_name TEXT,
        auditor_firm TEXT,
        status TEXT DEFAULT 'planned',
        start_date DATE,
        end_date DATE,
        findings_count INTEGER DEFAULT 0,
        critical_findings INTEGER DEFAULT 0,
        high_findings INTEGER DEFAULT 0,
        medium_findings INTEGER DEFAULT 0,
        low_findings INTEGER DEFAULT 0,
        overall_rating TEXT,
        report_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_finding (
        id SERIAL PRIMARY KEY,
        engagement_id INTEGER REFERENCES audit_engagement(id) ON DELETE CASCADE,
        finding_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        severity TEXT DEFAULT 'medium',
        category TEXT,
        status TEXT DEFAULT 'open',
        remediation_plan TEXT,
        owner TEXT,
        due_date DATE,
        resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
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
    const engagements = await client.query(`
      SELECT e.*,
        COUNT(f.id)::int AS actual_findings_count,
        COUNT(f.id) FILTER (WHERE f.severity = 'critical')::int AS actual_critical,
        COUNT(f.id) FILTER (WHERE f.severity = 'high')::int AS actual_high,
        COUNT(f.id) FILTER (WHERE f.severity = 'medium')::int AS actual_medium,
        COUNT(f.id) FILTER (WHERE f.severity = 'low')::int AS actual_low
      FROM audit_engagement e
      LEFT JOIN audit_finding f ON f.engagement_id = e.id
      GROUP BY e.id
      ORDER BY e.created_at DESC
    `).catch(() => ({ rows: [] }));

    return Response.json({ engagements: engagements.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureTables().catch(() => {});

  const body = await req.json().catch(() => null);
  if (!body || !body.title) {
    return Response.json({ error: 'title is required' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(`
      INSERT INTO audit_engagement
        (title, audit_type, scope, auditor_name, auditor_firm, status, start_date, end_date)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `, [
      body.title, body.audit_type || 'internal', body.scope || null,
      body.auditor_name || null, body.auditor_firm || null,
      body.status || 'planned', body.start_date || null,
      body.end_date || null,
    ]);
    return Response.json({ engagement: result.rows[0] }, { status: 201 });
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
      UPDATE audit_engagement SET
        status = COALESCE($2, status),
        overall_rating = COALESCE($3, overall_rating),
        report_url = COALESCE($4, report_url),
        end_date = COALESCE($5, end_date),
        findings_count = COALESCE($6, findings_count),
        critical_findings = COALESCE($7, critical_findings),
        high_findings = COALESCE($8, high_findings),
        medium_findings = COALESCE($9, medium_findings),
        low_findings = COALESCE($10, low_findings)
      WHERE id = $1
      RETURNING *
    `, [
      body.id, body.status || null, body.overall_rating || null,
      body.report_url || null, body.end_date || null,
      body.findings_count ?? null, body.critical_findings ?? null,
      body.high_findings ?? null, body.medium_findings ?? null,
      body.low_findings ?? null,
    ]);
    if (!result.rowCount) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ engagement: result.rows[0] });
  } finally {
    client.release();
  }
}
