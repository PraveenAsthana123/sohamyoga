import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const frameworkId = searchParams.get('framework_id');

  const client = await pool.connect();
  try {
    const controls = await client.query(`
      SELECT c.*, f.code AS framework_code, f.name AS framework_name
      FROM compliance_control c
      JOIN compliance_framework f ON f.id = c.framework_id
      ${frameworkId ? 'WHERE c.framework_id = $1' : ''}
      ORDER BY c.control_id
    `, frameworkId ? [frameworkId] : []).catch(() => ({ rows: [] }));

    return Response.json({ controls: controls.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (!body || !body.framework_id || !body.control_id || !body.control_name) {
    return Response.json({ error: 'framework_id, control_id, and control_name are required' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(`
      INSERT INTO compliance_control
        (framework_id, control_id, control_name, description, category, status, evidence_url, evidence_notes, owner, due_date)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `, [
      body.framework_id, body.control_id, body.control_name,
      body.description || null, body.category || null,
      body.status || 'not_started', body.evidence_url || null,
      body.evidence_notes || null, body.owner || null,
      body.due_date || null,
    ]);
    return Response.json({ control: result.rows[0] }, { status: 201 });
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
      UPDATE compliance_control SET
        status = COALESCE($2, status),
        evidence_url = COALESCE($3, evidence_url),
        evidence_notes = COALESCE($4, evidence_notes),
        owner = COALESCE($5, owner),
        due_date = COALESCE($6, due_date),
        last_updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [
      body.id, body.status || null, body.evidence_url || null,
      body.evidence_notes || null, body.owner || null,
      body.due_date || null,
    ]);
    if (!result.rowCount) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ control: result.rows[0] });
  } finally {
    client.release();
  }
}
