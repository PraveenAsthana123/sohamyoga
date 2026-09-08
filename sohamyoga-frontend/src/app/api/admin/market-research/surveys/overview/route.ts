import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real data for the /admin/survey dashboard (Overview/Surveys/Questions/
// Responses tabs), which previously rendered MOCK_SURVEYS/MOCK_RESPONSES/
// MOCK_QUESTIONS client constants exclusively -- confirmed via the page's
// own "mostly shows illustrative sample data" banner. survey/survey_question/
// survey_response/survey_answer all had real schema and a real create path
// (/admin/surveys, /api/admin/market-research/surveys) but this dashboard
// never read any of it. One combined endpoint (rather than 3 round trips)
// since all three lists are small and always shown together on this page.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const [surveys, responses, questions, npsBySurvey, answerDistribution, completionBuckets] = await Promise.all([
    query<{ id: string; title: string; type: string; status: string; response_count: number; completion_count: number }>(
      `SELECT id, title, type, status, response_count, completion_count FROM survey ORDER BY created_at DESC`,
    ),
    query<{ id: string; survey_title: string; respondent_email: string | null; respondent_id: string | null; status: string; completion_percent: string; time_spent_seconds: number | null; submitted_at: string | null }>(
      `SELECT sr.id, s.title AS survey_title, sr.respondent_email, sr.respondent_id, sr.status,
              sr.completion_percent, sr.time_spent_seconds, sr.submitted_at
       FROM survey_response sr JOIN survey s ON s.id = sr.survey_id
       ORDER BY sr.created_at DESC LIMIT 200`,
    ),
    query<{ id: string; survey_title: string; type: string; text: string; is_required: boolean; display_order: number }>(
      `SELECT sq.id, s.title AS survey_title, sq.type, sq.text, sq.is_required, sq.display_order
       FROM survey_question sq JOIN survey s ON s.id = sq.survey_id
       ORDER BY s.title, sq.display_order`,
    ),
    // Real NPS = (promoters - detractors) / total * 100, computed from actual
    // survey_answer.value_number on nps-type questions -- same formula
    // NpsCalculationJob uses, but scoped per-survey here rather than only
    // the single dedicated NPS pipeline survey.
    query<{ survey_id: string; total: string; promoters: string; detractors: string }>(
      `SELECT sq.survey_id,
              COUNT(*) AS total,
              COUNT(*) FILTER (WHERE sa.value_number >= 9) AS promoters,
              COUNT(*) FILTER (WHERE sa.value_number <= 6) AS detractors
       FROM survey_answer sa JOIN survey_question sq ON sq.id = sa.question_id
       WHERE sq.type = 'nps' AND sa.value_number IS NOT NULL
       GROUP BY sq.survey_id`,
    ),
    // Real answer distribution -- replaces a previously fully-hardcoded
    // "Top Answers" sample array. Covers choice-type answers stored either
    // as a single value_text (single_choice) or a value_array (multiple_
    // choice/checkbox) -- unnest() flattens both into one option per row.
    query<{ option: string; count: string }>(
      `SELECT option_label AS option, COUNT(*) AS count FROM (
         SELECT sa.value_text AS option_label FROM survey_answer sa JOIN survey_question sq ON sq.id = sa.question_id
         WHERE sq.type = 'single_choice' AND sa.value_text IS NOT NULL
         UNION ALL
         SELECT unnest(sa.value_array) AS option_label FROM survey_answer sa JOIN survey_question sq ON sq.id = sa.question_id
         WHERE sq.type IN ('multiple_choice','checkbox') AND sa.value_array IS NOT NULL
       ) opts
       GROUP BY option_label ORDER BY count DESC LIMIT 8`,
    ),
    // Real completion-percent histogram -- replaces a previously fully-
    // hardcoded per-question "Drop-off Analysis" step funnel (this
    // codebase only tracks completion_percent at the response level, not
    // per-question abandonment, so a per-question funnel would have to be
    // fabricated; a real bucketed histogram of the one real metric that
    // does exist is the honest substitute).
    query<{ bucket: string; count: string }>(
      `SELECT CASE
         WHEN completion_percent >= 100 THEN '100%'
         WHEN completion_percent >= 75  THEN '75-99%'
         WHEN completion_percent >= 50  THEN '50-74%'
         WHEN completion_percent >= 25  THEN '25-49%'
         ELSE '0-24%' END AS bucket,
         COUNT(*) AS count
       FROM survey_response GROUP BY 1`,
    ),
  ]);

  const npsMap = new Map(npsBySurvey.rows.map(r => [
    r.survey_id, Math.round(((Number(r.promoters) - Number(r.detractors)) / Number(r.total)) * 100),
  ]));

  function formatDuration(seconds: number | null): string {
    if (seconds == null) return '—';
    const m = Math.floor(seconds / 60), s = seconds % 60;
    return `${m}m ${s}s`;
  }

  return Response.json({
    surveys: surveys.rows.map(s => ({
      id: s.id, title: s.title, type: s.type, status: s.status,
      responses: s.response_count, completion: s.response_count > 0 ? Math.round((s.completion_count / s.response_count) * 100) : 0,
      nps: npsMap.has(s.id) ? npsMap.get(s.id) : undefined,
    })),
    responses: responses.rows.map(r => ({
      id: r.id, survey: r.survey_title, respondent: r.respondent_email ?? (r.respondent_id ? 'Registered user' : 'Anonymous'),
      status: r.status, completion: Math.round(Number(r.completion_percent)), duration: formatDuration(r.time_spent_seconds),
      submittedAt: r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '—',
    })),
    questions: questions.rows.map(q => ({
      id: q.id, survey: q.survey_title, type: q.type, text: q.text, required: q.is_required, order: q.display_order,
      logic: false, // no branching/skip-logic feature exists in this codebase -- honest false, not fabricated
    })),
    answerDistribution: answerDistribution.rows.map(r => ({ option: r.option, count: Number(r.count) })),
    completionBuckets: completionBuckets.rows.map(r => ({ bucket: r.bucket, count: Number(r.count) })),
  });
}
