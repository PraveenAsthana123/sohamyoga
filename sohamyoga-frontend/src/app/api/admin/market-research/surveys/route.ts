import { NextRequest } from 'next/server';
import { requireAdmin, getAdminPrincipal } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SurveyRow { id: string; slug: string; title: string; status: string }

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const result = await query<SurveyRow>('SELECT id, slug, title, status FROM survey ORDER BY created_at DESC');
  return Response.json({ surveys: result.rows });
}

const QUESTION_TYPES = new Set([
  'single_choice', 'multiple_choice', 'checkbox', 'rating_scale', 'matrix_grid', 'short_text',
  'long_text', 'file_upload', 'digital_signature', 'date', 'number', 'email', 'phone', 'nps',
]);
const SURVEY_TYPES = new Set(['survey', 'questionnaire', 'form', 'quiz', 'assessment', 'poll', 'nps', 'feedback', 'ces']);

interface QuestionInput {
  type?: string; text?: string; isRequired?: boolean; options?: string[];
  ratingMin?: number; ratingMax?: number;
}

// Real Create Survey Screen + Survey Question Builder -- survey/
// survey_question/survey_question_option had a rich real schema but only
// ever populated by seed SQL, confirmed via grep (no INSERT INTO survey
// anywhere in application code). First real write path.
export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    title?: string; description?: string; type?: string; questions?: QuestionInput[];
  } | null;
  if (!body?.title?.trim()) return Response.json({ error: 'title is required.' }, { status: 400 });
  const type = SURVEY_TYPES.has(body.type ?? '') ? body.type! : 'survey';
  const questions = Array.isArray(body.questions) ? body.questions : [];
  if (questions.length === 0) return Response.json({ error: 'At least one question is required.' }, { status: 400 });
  for (const q of questions) {
    if (!q.text?.trim() || !QUESTION_TYPES.has(q.type ?? '')) {
      return Response.json({ error: `Each question needs text and a valid type (${[...QUESTION_TYPES].join('|')}).` }, { status: 400 });
    }
  }

  const slug = `${body.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}-${Date.now().toString(36)}`;
  const survey = await query<{ id: string }>(
    `INSERT INTO survey (slug, title, description, type, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [slug, body.title.trim(), body.description?.trim() || null, type, principal!.id],
  );
  const surveyId = survey.rows[0].id;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const question = await query<{ id: string }>(
      `INSERT INTO survey_question (survey_id, type, text, is_required, display_order, rating_min, rating_max)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [surveyId, q.type, q.text!.trim(), Boolean(q.isRequired), i, q.ratingMin ?? null, q.ratingMax ?? null],
    );
    const options = (q.options ?? []).map(o => o.trim()).filter(Boolean);
    for (let j = 0; j < options.length; j++) {
      await query(
        `INSERT INTO survey_question_option (question_id, label, value, display_order) VALUES ($1,$2,$2,$3)`,
        [question.rows[0].id, options[j], j],
      );
    }
  }

  return Response.json({ ok: true, surveyId, slug }, { status: 201 });
}
