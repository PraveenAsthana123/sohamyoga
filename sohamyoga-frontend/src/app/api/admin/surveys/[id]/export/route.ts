import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });

  const { id } = await Promise.resolve(params);

  const questions = await query(
    `SELECT id, question_text, question_type, sort_order FROM survey_question WHERE survey_id=$1 ORDER BY sort_order`,
    [id]
  );

  const responses = await query(
    `SELECT r.id, r.respondent_email, r.respondent_name, r.is_complete, r.started_at, r.completed_at,
            r.completion_time_seconds
     FROM survey_response r WHERE r.survey_id=$1 ORDER BY r.started_at`,
    [id]
  );

  const answers = await query(
    `SELECT a.response_id, a.question_id, a.answer_text, a.answer_value
     FROM survey_answer a
     JOIN survey_response r ON r.id = a.response_id
     WHERE r.survey_id=$1`,
    [id]
  );

  // Build answer lookup: responseId -> questionId -> answer
  const answerMap: Record<number, Record<number, string>> = {};
  for (const a of answers.rows as { response_id: number; question_id: number; answer_text: string; answer_value: unknown }[]) {
    if (!answerMap[a.response_id]) answerMap[a.response_id] = {};
    answerMap[a.response_id][a.question_id] = a.answer_text ?? JSON.stringify(a.answer_value) ?? '';
  }

  const qs = questions.rows as { id: number; question_text: string; question_type: string }[];
  const headers = ['response_id', 'respondent_email', 'respondent_name', 'is_complete', 'started_at', 'completed_at', 'duration_seconds', ...qs.map(q => `"${q.question_text.replace(/"/g, '""')}"`),];

  const lines: string[] = [headers.join(',')];
  for (const r of responses.rows as { id: number; respondent_email: string; respondent_name: string; is_complete: boolean; started_at: string; completed_at: string; completion_time_seconds: number }[]) {
    const cells = [
      String(r.id),
      `"${(r.respondent_email ?? '').replace(/"/g, '""')}"`,
      `"${(r.respondent_name ?? '').replace(/"/g, '""')}"`,
      r.is_complete ? 'true' : 'false',
      r.started_at ?? '',
      r.completed_at ?? '',
      String(r.completion_time_seconds ?? ''),
      ...qs.map(q => `"${((answerMap[r.id]?.[q.id]) ?? '').replace(/"/g, '""')}"`),
    ];
    lines.push(cells.join(','));
  }

  const csv = lines.join('\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="survey-${id}-responses.csv"`,
    },
  });
}
