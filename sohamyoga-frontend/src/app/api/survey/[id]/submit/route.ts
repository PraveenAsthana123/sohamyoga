import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public endpoint — no auth required for survey submission
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });

  const { id } = await Promise.resolve(params);
  const body = await req.json() as {
    respondent_email?: string;
    respondent_name?: string;
    answers: Array<{ question_id: number; answer_text?: string; answer_value?: unknown }>;
  };

  // Ensure tables exist
  await query(`CREATE TABLE IF NOT EXISTS survey_response (
    id SERIAL PRIMARY KEY,
    survey_id INT NOT NULL,
    respondent_email VARCHAR(200),
    respondent_name VARCHAR(200),
    ip_address VARCHAR(50),
    completion_time_seconds INT,
    is_complete BOOLEAN DEFAULT false,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
  )`, []);

  await query(`CREATE TABLE IF NOT EXISTS survey_answer (
    id SERIAL PRIMARY KEY,
    response_id INT REFERENCES survey_response(id) ON DELETE CASCADE,
    question_id INT REFERENCES survey_question(id),
    answer_text TEXT,
    answer_value JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`, []);

  // Check survey exists and is active
  const surveyCheck = await query(`SELECT id, status FROM survey WHERE id=$1`, [id]);
  if (surveyCheck.rows.length === 0) {
    return Response.json({ error: 'Survey not found' }, { status: 404 });
  }
  if (surveyCheck.rows[0].status !== 'active') {
    return Response.json({ error: 'Survey is not currently accepting responses' }, { status: 403 });
  }

  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';

  const responseRow = await query(
    `INSERT INTO survey_response (survey_id, respondent_email, respondent_name, ip_address, is_complete, completed_at)
     VALUES ($1,$2,$3,$4,true,NOW()) RETURNING id`,
    [id, body.respondent_email ?? null, body.respondent_name ?? null, ip]
  );

  const responseId = responseRow.rows[0].id;

  for (const answer of (body.answers ?? [])) {
    await query(
      `INSERT INTO survey_answer (response_id, question_id, answer_text, answer_value)
       VALUES ($1,$2,$3,$4)`,
      [
        responseId,
        answer.question_id,
        answer.answer_text ?? null,
        answer.answer_value != null ? JSON.stringify(answer.answer_value) : null,
      ]
    );
  }

  return Response.json({ ok: true, response_id: responseId });
}
