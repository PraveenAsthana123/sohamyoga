import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { npsCategory } from '@/cron/jobs/NpsCalculationJob';
import { csatCategory } from '@/cron/jobs/CsatCalculationJob';
import { cesCategory } from '@/cron/jobs/CesCalculationJob';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real CX Dashboard -- combines the three real, already-computed metrics
// (NpsCalculationJob's nps_score, CsatCalculationJob's csat_score,
// CesCalculationJob's ces_score) into one view. No new metric, no AI
// opinion -- just honest aggregation of what already exists.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const rows = await query<{
    survey_id: string; title: string; type: string; total_responses: number; completed_responses: number;
    completion_rate: string; nps_score: string | null; csat_score: string | null; ces_score: string | null; calculated_at: string;
  }>(
    `SELECT sa.survey_id, s.title, s.type, sa.total_responses, sa.completed_responses,
            sa.completion_rate, sa.nps_score, sa.csat_score, sa.ces_score, sa.calculated_at
     FROM survey_analytics sa JOIN survey s ON s.id = sa.survey_id
     WHERE sa.nps_score IS NOT NULL OR sa.csat_score IS NOT NULL OR sa.ces_score IS NOT NULL
     ORDER BY sa.calculated_at DESC`,
  );

  const surveys = rows.rows.map(r => ({
    surveyId: r.survey_id, title: r.title, type: r.type, totalResponses: r.total_responses,
    completedResponses: r.completed_responses, completionRate: Number(r.completion_rate),
    npsScore: r.nps_score !== null ? Number(r.nps_score) : null,
    npsCategory: r.nps_score !== null ? npsCategory(Number(r.nps_score)) : null,
    csatScore: r.csat_score !== null ? Number(r.csat_score) : null,
    csatCategory: r.csat_score !== null ? csatCategory(Number(r.csat_score)) : null,
    cesScore: r.ces_score !== null ? Number(r.ces_score) : null,
    cesCategory: r.ces_score !== null ? cesCategory(Number(r.ces_score)) : null,
    calculatedAt: r.calculated_at,
  }));

  const npsSurveys = surveys.filter(s => s.npsScore !== null);
  const csatSurveys = surveys.filter(s => s.csatScore !== null);
  const cesSurveys = surveys.filter(s => s.cesScore !== null);
  const overallNps = npsSurveys.length ? Math.round((npsSurveys.reduce((sum, s) => sum + (s.npsScore ?? 0), 0) / npsSurveys.length) * 100) / 100 : null;
  const overallCsat = csatSurveys.length ? Math.round((csatSurveys.reduce((sum, s) => sum + (s.csatScore ?? 0), 0) / csatSurveys.length) * 100) / 100 : null;
  const overallCes = cesSurveys.length ? Math.round((cesSurveys.reduce((sum, s) => sum + (s.cesScore ?? 0), 0) / cesSurveys.length) * 100) / 100 : null;

  return Response.json({ surveys, overallNps, overallCsat, overallCes, cesTracked: cesSurveys.length > 0 });
}
