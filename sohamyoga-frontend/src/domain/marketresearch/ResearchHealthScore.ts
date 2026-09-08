import { query } from '@/lib/postgres';
import { combineWeightedScore } from '@/domain/shared/HealthModel';

export interface ResearchHealthReport {
  overallScore: number;
  projectMomentum: { total: number; completed: number; stuckInPlanning: number; score: number };
  surveyQuality: { assessedResponses: number; avgQualityScore: number | null; score: number };
  responseCompletion: { activeSurveys: number; avgCompletionRate: number | null; score: number };
}

/** Real "Executive Research Health Score" -- a weighted rollup of three
 * already-real signals (research_project lifecycle, survey_response
 * quality_score from QualityDetector, survey completion rate), not a
 * fabricated composite metric. Each component defaults to a neutral 100
 * when there's no data yet to assess, same null-safe convention as
 * RespondentQualityScore, so an empty tenant reads as "nothing flagged"
 * rather than a misleading 0. */
export async function computeResearchHealthScore(tenantId: string): Promise<ResearchHealthReport> {
  const projects = await query<{ status: string; created_at: Date }>(
    'SELECT status, created_at FROM research_project WHERE tenant_id = $1',
    [tenantId]
  );
  const total = projects.rows.length;
  const completed = projects.rows.filter((p) => p.status === 'completed').length;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const stuckInPlanning = projects.rows.filter((p) => p.status === 'planning' && p.created_at < thirtyDaysAgo).length;
  const projectScore = total === 0 ? 100 : Math.round(((total - stuckInPlanning) / total) * 100);

  const qualityResult = await query<{ avg: string | null; n: string }>(
    `SELECT avg(quality_score)::text AS avg, count(quality_score)::text AS n
     FROM survey_response WHERE quality_score IS NOT NULL AND created_at > now() - interval '90 days'`
  );
  const avgQuality = qualityResult.rows[0].avg !== null ? Number(qualityResult.rows[0].avg) : null;
  const assessedResponses = Number(qualityResult.rows[0].n);
  const qualityScore = avgQuality !== null ? Math.round(avgQuality) : 100;

  const surveys = await query<{ response_count: number; completion_count: number }>(
    `SELECT response_count, completion_count FROM survey WHERE status = 'active'`
  );
  const activeSurveys = surveys.rows.length;
  const rates = surveys.rows.filter((s) => s.response_count > 0).map((s) => s.completion_count / s.response_count);
  const avgCompletionRate = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
  const completionScore = avgCompletionRate !== null ? Math.round(avgCompletionRate * 100) : 100;

  const overallScore = combineWeightedScore([
    { score: projectScore, weight: 1 },
    { score: qualityScore, weight: 1 },
    { score: completionScore, weight: 1 },
  ]);

  return {
    overallScore,
    projectMomentum: { total, completed, stuckInPlanning, score: projectScore },
    surveyQuality: { assessedResponses, avgQualityScore: avgQuality, score: qualityScore },
    responseCompletion: { activeSurveys, avgCompletionRate, score: completionScore },
  };
}
