import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const conditions = status ? `WHERE ce.status=$1` : '';
    const values = status ? [status] : [];
    const { rows } = await pool.query(`
      SELECT ce.*,
        cr.customer_name, cr.customer_email, cr.score, cr.follow_up_text, cr.survey_id,
        cs.name AS survey_name,
        EXTRACT(EPOCH FROM (NOW() - ce.created_at)) / 3600 AS hours_open
      FROM complaint_escalations ce
      JOIN csat_responses cr ON cr.id = ce.response_id
      JOIN csat_surveys cs ON cs.id = cr.survey_id
      ${conditions}
      ORDER BY ce.created_at DESC
    `, values);
    return Response.json({ escalations: rows });
  } catch (err) {
    console.error('CSAT escalate GET error:', err);
    return Response.json({ error: 'Failed to load escalations' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request body' }, { status: 400 });
    const { response_id, escalation_type, reason, assigned_to } = body as Record<string, unknown>;
    if (!response_id || typeof response_id !== 'string') return Response.json({ error: 'response_id is required' }, { status: 400 });
    if (!escalation_type || typeof escalation_type !== 'string') return Response.json({ error: 'escalation_type is required' }, { status: 400 });
    const validTypes = ['manager', 'legal', 'executive', 'refund'];
    if (!validTypes.includes(escalation_type)) {
      return Response.json({ error: `escalation_type must be one of: ${validTypes.join(', ')}` }, { status: 400 });
    }
    const { rows: responseCheck } = await pool.query(`SELECT id FROM csat_responses WHERE id=$1`, [response_id]);
    if (!responseCheck.length) return Response.json({ error: 'Response not found' }, { status: 404 });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(`
        INSERT INTO complaint_escalations (response_id, escalation_type, reason, assigned_to)
        VALUES ($1,$2,$3,$4) RETURNING *
      `, [
        response_id,
        escalation_type,
        typeof reason === 'string' ? reason.trim() : null,
        typeof assigned_to === 'string' ? assigned_to.trim() : null,
      ]);
      await client.query(`
        UPDATE csat_responses SET
          is_escalated = true,
          escalation_level = $2,
          legal_flag = $3
        WHERE id = $1
      `, [response_id, escalation_type, escalation_type === 'legal']);
      await client.query('COMMIT');
      return Response.json({ escalation: rows[0] }, { status: 201 });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('CSAT escalate POST error:', err);
    return Response.json({ error: 'Failed to create escalation' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request body' }, { status: 400 });
    const { id, status, resolution_text, legal_notes, response_id } = body as Record<string, unknown>;

    if (id && typeof id === 'string') {
      const { rows } = await pool.query(`
        UPDATE complaint_escalations SET
          status = COALESCE($2, status),
          resolution_text = COALESCE($3, resolution_text),
          resolved_at = CASE WHEN $2='resolved' OR $2='closed' THEN NOW() ELSE resolved_at END
        WHERE id = $1 RETURNING *
      `, [id, status || null, resolution_text || null]);
      if (!rows.length) return Response.json({ error: 'Escalation not found' }, { status: 404 });
      return Response.json({ escalation: rows[0] });
    }

    if (response_id && typeof response_id === 'string' && typeof legal_notes === 'string') {
      const { rows } = await pool.query(`UPDATE csat_responses SET legal_notes=$2 WHERE id=$1 RETURNING id`, [response_id, legal_notes.trim()]);
      if (!rows.length) return Response.json({ error: 'Response not found' }, { status: 404 });
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Provide id (escalation) or response_id + legal_notes' }, { status: 400 });
  } catch (err) {
    console.error('CSAT escalate PATCH error:', err);
    return Response.json({ error: 'Failed to update escalation' }, { status: 500 });
  }
}
