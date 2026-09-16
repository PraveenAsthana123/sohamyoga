import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Params): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  try {
    const { rows: surveys } = await pool.query(`SELECT * FROM csat_surveys WHERE id=$1`, [params.id]);
    if (!surveys.length) return Response.json({ error: 'Survey not found' }, { status: 404 });
    const [responses, distribution] = await Promise.all([
      pool.query(`SELECT * FROM csat_responses WHERE survey_id=$1 ORDER BY created_at DESC`, [params.id]),
      pool.query(`
        SELECT score, COUNT(*) AS count,
          ROUND(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM csat_responses WHERE survey_id=$1),0), 1) AS pct
        FROM csat_responses WHERE survey_id=$1
        GROUP BY score ORDER BY score
      `, [params.id]),
    ]);
    return Response.json({ survey: surveys[0], responses: responses.rows, distribution: distribution.rows });
  } catch (err) {
    console.error('CSAT [id] GET error:', err);
    return Response.json({ error: 'Failed to load survey' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request body' }, { status: 400 });
    const allowed = ['name', 'trigger_event', 'question_text', 'scale', 'follow_up_question', 'status'];
    const setClauses: string[] = [];
    const values: unknown[] = [];
    for (const [key, val] of Object.entries(body as Record<string, unknown>)) {
      if (allowed.includes(key) && val !== undefined) {
        values.push(val);
        setClauses.push(`${key}=$${values.length}`);
      }
    }
    if (!setClauses.length) return Response.json({ error: 'No valid fields to update' }, { status: 400 });
    values.push(params.id);
    const { rows } = await pool.query(
      `UPDATE csat_surveys SET ${setClauses.join(',')} WHERE id=$${values.length} RETURNING *`,
      values
    );
    if (!rows.length) return Response.json({ error: 'Survey not found' }, { status: 404 });
    return Response.json({ survey: rows[0] });
  } catch (err) {
    console.error('CSAT [id] PATCH error:', err);
    return Response.json({ error: 'Failed to update survey' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  try {
    const { rowCount } = await pool.query(`DELETE FROM csat_surveys WHERE id=$1`, [params.id]);
    if (!rowCount) return Response.json({ error: 'Survey not found' }, { status: 404 });
    return Response.json({ ok: true });
  } catch (err) {
    console.error('CSAT [id] DELETE error:', err);
    return Response.json({ error: 'Failed to delete survey' }, { status: 500 });
  }
}
