// GET /api/survey/nps-summary — real NPS data for the admin Survey page.
// Replaces what were previously hardcoded numbers with the actual output of
// NpsCalculationJob (v_nps_leaderboard + survey_question_summary).

import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  // Not v_nps_leaderboard directly — its INNER JOIN to survey_analytics means
  // a real, active NPS survey with zero calculated data (NpsCalculationJob
  // hasn't run since a response came in, or no responses exist yet) simply
  // never appears, rather than showing an honest "no data yet" row.
  const leaderboard = await query<{
    id: string; title: string; nps_score: string | null; total_responses: string | null;
    completed_responses: string | null; nps_category: string;
  }>(
    `SELECT s.id, s.title, sa.nps_score, sa.total_responses, sa.completed_responses,
            CASE
              WHEN sa.nps_score IS NULL THEN 'no_data'
              WHEN sa.nps_score >= 70 THEN 'excellent'
              WHEN sa.nps_score >= 30 THEN 'good'
              WHEN sa.nps_score >= 0  THEN 'needs_improvement'
              ELSE 'critical'
            END AS nps_category
     FROM survey s
     LEFT JOIN survey_analytics sa ON sa.survey_id = s.id
     WHERE s.type = 'nps'
     ORDER BY sa.nps_score DESC NULLS LAST`,
  );

  const questionSummaries = await query<{
    survey_id: string; question_type: string; question_text: string; total_answers: string;
    promoters: number | null; passives: number | null; detractors: number | null;
    option_counts: Record<string, number> | null; text_sample: string[] | null;
  }>(
    `SELECT sa.survey_id, qs.question_type, qs.question_text, qs.total_answers,
            qs.promoters, qs.passives, qs.detractors, qs.option_counts, qs.text_sample
     FROM survey_question_summary qs
     JOIN survey_analytics sa ON sa.id = qs.analytics_id
     JOIN survey s ON s.id = sa.survey_id
     WHERE s.type = 'nps'`,
  );

  return Response.json({
    surveys: leaderboard.rows.map(r => ({
      id: r.id, title: r.title,
      npsScore: r.nps_score !== null ? Number(r.nps_score) : null,
      totalResponses: Number(r.total_responses ?? 0),
      completedResponses: Number(r.completed_responses ?? 0),
      category: r.nps_category,
      questions: questionSummaries.rows.filter(q => q.survey_id === r.id).map(q => ({
        type: q.question_type, text: q.question_text, totalAnswers: Number(q.total_answers),
        promoters: q.promoters ?? undefined, passives: q.passives ?? undefined, detractors: q.detractors ?? undefined,
        sentimentCounts: q.question_type === 'long_text' ? (q.option_counts ?? undefined) : undefined,
        textSample: q.text_sample ?? undefined,
      })),
    })),
  });
}
