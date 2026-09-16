import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const engagementId = searchParams.get('engagement_id');
  const severity = searchParams.get('severity');
  const status = searchParams.get('status');

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (engagementId) { params.push(engagementId); conditions.push(`f.engagement_id = $${params.length}`); }
  if (severity) { params.push(severity); conditions.push(`f.severity = $${params.length}`); }
  if (status) { params.push(status); conditions.push(`f.status = $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const client = await pool.connect();
  try {
    const findings = await client.query(`
      SELECT f.*, e.title AS engagement_title, e.audit_type,
        CASE WHEN f.due_date < NOW() AND f.status NOT IN ('resolved','closed') THEN
          EXTRACT(DAY FROM NOW() - f.due_date)::int
        ELSE NULL END AS days_overdue
      FROM audit_finding f
      LEFT JOIN audit_engagement e ON e.id = f.engagement_id
      ${where}
      ORDER BY
        CASE f.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END,
        f.due_date ASC NULLS LAST,
        f.created_at DESC
    `, params).catch(() => ({ rows: [] }));

    return Response.json({ findings: findings.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (!body || !body.engagement_id || !body.title) {
    return Response.json({ error: 'engagement_id and title are required' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(`
      INSERT INTO audit_finding
        (engagement_id, finding_id, title, description, severity, category, status, remediation_plan, owner, due_date)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `, [
      body.engagement_id, body.finding_id || null, body.title,
      body.description || null, body.severity || 'medium',
      body.category || null, body.status || 'open',
      body.remediation_plan || null, body.owner || null,
      body.due_date || null,
    ]);

    // Update engagement finding counts
    await client.query(`
      UPDATE audit_engagement SET
        findings_count = (SELECT COUNT(*) FROM audit_finding WHERE engagement_id = $1),
        critical_findings = (SELECT COUNT(*) FROM audit_finding WHERE engagement_id = $1 AND severity = 'critical'),
        high_findings = (SELECT COUNT(*) FROM audit_finding WHERE engagement_id = $1 AND severity = 'high'),
        medium_findings = (SELECT COUNT(*) FROM audit_finding WHERE engagement_id = $1 AND severity = 'medium'),
        low_findings = (SELECT COUNT(*) FROM audit_finding WHERE engagement_id = $1 AND severity = 'low')
      WHERE id = $1
    `, [body.engagement_id]);

    return Response.json({ finding: result.rows[0] }, { status: 201 });
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
    const resolvedAt = body.status === 'resolved' ? 'NOW()' : 'resolved_at';
    const result = await client.query(`
      UPDATE audit_finding SET
        status = COALESCE($2, status),
        remediation_plan = COALESCE($3, remediation_plan),
        owner = COALESCE($4, owner),
        due_date = COALESCE($5, due_date),
        resolved_at = CASE WHEN $2 = 'resolved' THEN NOW() ELSE ${resolvedAt} END
      WHERE id = $1
      RETURNING *
    `, [
      body.id, body.status || null, body.remediation_plan || null,
      body.owner || null, body.due_date || null,
    ]);
    if (!result.rowCount) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ finding: result.rows[0] });
  } finally {
    client.release();
  }
}
