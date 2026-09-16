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
    const url = new URL(req.url);
    const score = url.searchParams.get('score');
    const sentiment = url.searchParams.get('sentiment');
    const escalated = url.searchParams.get('escalated');
    const legal = url.searchParams.get('legal');
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['survey_id=$1'];
    const values: unknown[] = [params.id];
    if (score) { values.push(parseInt(score)); conditions.push(`score=$${values.length}`); }
    if (sentiment) { values.push(sentiment); conditions.push(`sentiment=$${values.length}`); }
    if (escalated === 'true') conditions.push('is_escalated=true');
    if (escalated === 'false') conditions.push('is_escalated=false');
    if (legal === 'true') conditions.push('legal_flag=true');

    const where = conditions.join(' AND ');
    const [responses, total] = await Promise.all([
      pool.query(`SELECT * FROM csat_responses WHERE ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`, values),
      pool.query(`SELECT COUNT(*) AS cnt FROM csat_responses WHERE ${where}`, values),
    ]);
    return Response.json({
      responses: responses.rows,
      total: parseInt(total.rows[0].cnt),
      page,
      limit,
    });
  } catch (err) {
    console.error('CSAT responses GET error:', err);
    return Response.json({ error: 'Failed to load responses' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params): Promise<Response> {
  // Public submission endpoint — no auth required for submitting
  const pool = getPool();
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request body' }, { status: 400 });
    const { customer_email, customer_name, score, follow_up_text, source } = body as Record<string, unknown>;
    if (typeof score !== 'number' || score < 1 || score > 10) {
      return Response.json({ error: 'Score must be between 1 and 10' }, { status: 400 });
    }
    const { rows: surveys } = await pool.query(`SELECT scale FROM csat_surveys WHERE id=$1 AND status='active'`, [params.id]);
    if (!surveys.length) return Response.json({ error: 'Survey not found or inactive' }, { status: 404 });
    if (score > surveys[0].scale) {
      return Response.json({ error: `Score must be between 1 and ${surveys[0].scale}` }, { status: 400 });
    }
    const sentiment = score >= 4 ? 'positive' : score === 3 ? 'neutral' : 'negative';
    const severity = score === 1 ? 'critical' : score === 2 ? 'high' : score === 3 ? 'medium' : 'low';
    const validSources = ['email', 'sms', 'web', 'qr', 'in_app'];
    const src = typeof source === 'string' && validSources.includes(source) ? source : 'web';

    const { rows } = await pool.query(`
      INSERT INTO csat_responses (survey_id, customer_email, customer_name, score, follow_up_text, sentiment, complaint_severity, source)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [
      params.id,
      typeof customer_email === 'string' ? customer_email.trim() : null,
      typeof customer_name === 'string' ? customer_name.trim() : null,
      score,
      typeof follow_up_text === 'string' ? follow_up_text.trim() : null,
      sentiment,
      severity,
      src,
    ]);

    // Update survey aggregate stats
    await pool.query(`
      UPDATE csat_surveys SET
        total_responses = (SELECT COUNT(*) FROM csat_responses WHERE survey_id=$1),
        avg_score = (SELECT AVG(score) FROM csat_responses WHERE survey_id=$1),
        distribution_json = (
          SELECT jsonb_object_agg(score::text, cnt) FROM (
            SELECT score, COUNT(*) AS cnt FROM csat_responses WHERE survey_id=$1 GROUP BY score
          ) t
        )
      WHERE id=$1
    `, [params.id]);

    return Response.json({ response: rows[0] }, { status: 201 });
  } catch (err) {
    console.error('CSAT responses POST error:', err);
    return Response.json({ error: 'Failed to submit response' }, { status: 500 });
  }
}
