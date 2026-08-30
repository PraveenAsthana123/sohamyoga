import { NextRequest } from 'next/server';
import { requireAdmin } from '../../../../../../lib/session-auth';
import { getPhaseRunByStudyAndSlug, getPhaseRunTransactions, getPhaseRunAiLogs, getStudy } from '../../../../../../domain/pipeline/PipelineService';
import { getLastJobRun } from '../../../../../../domain/pipeline/JobRunTracker';

export async function GET(req: NextRequest, { params }: { params: { studyId: string; phaseSlug: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const study = await getStudy(params.studyId);
  if (!study) return Response.json({ error: `Study "${params.studyId}" not found.` }, { status: 404 });

  const detail = await getPhaseRunByStudyAndSlug(params.studyId, params.phaseSlug);
  if (!detail) return Response.json({ error: `Phase "${params.phaseSlug}" has no run for study "${params.studyId}".` }, { status: 404 });

  const [transactions, aiLogs, researchAiJobRun, pricingJobRun, reviewsJobRun] = await Promise.all([
    getPhaseRunTransactions(detail.phaseRun.id),
    getPhaseRunAiLogs(detail.phaseRun.id),
    getLastJobRun('ResearchAiDraftJob', params.studyId),
    detail.phase.slug === 'pricing' ? getLastJobRun('PricingCrossPortalJob', params.studyId) : Promise.resolve(null),
    detail.phase.slug === 'reviews' ? getLastJobRun('ReviewsCrossPortalJob', params.studyId) : Promise.resolve(null),
  ]);

  return Response.json({
    study,
    phase: detail.phase,
    phaseRun: detail.phaseRun,
    transactions,
    aiLogs,
    jobRuns: { researchAiJobRun, pricingJobRun, reviewsJobRun },
  });
}
