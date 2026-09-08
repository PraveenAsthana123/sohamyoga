import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real public read for the general multi-question Survey Builder (built
// earlier this session) -- distinct from /api/survey/[slug]/respond, which
// is NPS-specific (single npsScore/reasonText). This is the missing
// customer self-service side: a general survey could be created for real,
// but had no way for anyone to actually answer it.
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { slug } = await params;
  const survey = await query<{ id: string; title: string; description: string | null; status: string; consent_required: boolean; consent_text: string }>(
    `SELECT id, title, description, status, consent_required, consent_text FROM survey WHERE slug = $1`, [slug],
  );
  if (!survey.rowCount) return Response.json({ error: 'Survey not found.' }, { status: 404 });
  if (survey.rows[0].status !== 'active') return Response.json({ error: 'This survey is not currently accepting responses.' }, { status: 410 });
  const s = survey.rows[0];

  const questions = await query<{ id: string; type: string; text: string; is_required: boolean; display_order: number; rating_min: number | null; rating_max: number | null }>(
    `SELECT id, type, text, is_required, display_order, rating_min, rating_max FROM survey_question WHERE survey_id = $1 ORDER BY display_order`,
    [s.id],
  );
  const options = await query<{ question_id: string; label: string }>(
    `SELECT question_id, label FROM survey_question_option WHERE question_id = ANY($1) ORDER BY display_order`,
    [questions.rows.map(q => q.id)],
  );
  const optionsByQuestion = new Map<string, string[]>();
  for (const o of options.rows) {
    if (!optionsByQuestion.has(o.question_id)) optionsByQuestion.set(o.question_id, []);
    optionsByQuestion.get(o.question_id)!.push(o.label);
  }

  return Response.json({
    id: s.id, title: s.title, description: s.description,
    consentRequired: s.consent_required, consentText: s.consent_text,
    questions: questions.rows.map(q => ({
      id: q.id, type: q.type, text: q.text, required: q.is_required,
      ratingMin: q.rating_min ?? undefined, ratingMax: q.rating_max ?? undefined,
      options: optionsByQuestion.get(q.id) ?? [],
    })),
  });
}
