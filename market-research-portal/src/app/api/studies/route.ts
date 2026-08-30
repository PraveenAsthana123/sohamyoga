import { NextRequest } from 'next/server';
import { requireAdmin } from '../../../lib/session-auth';
import { createStudy, listStudies } from '../../../domain/pipeline/PipelineService';
import { runJob } from '../../../domain/pipeline/runJob';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const studies = await listStudies();
  return Response.json({ studies });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  let body: { topicName?: string; businessModel?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const topicName = body.topicName?.trim();
  if (!topicName) {
    return Response.json({ error: 'topicName is required.' }, { status: 400 });
  }
  if (body.businessModel !== 'b2b' && body.businessModel !== 'b2c') {
    return Response.json({ error: 'businessModel is required and must be "b2b" or "b2c".' }, { status: 400 });
  }
  const businessModel = body.businessModel;

  const { study, phaseRunIds } = await createStudy(topicName, businessModel);

  // Kick off ResearchAiDraftJob for every phase, async / not blocking the
  // response — the master page's status grid polls GET /api/studies/[id]
  // and watches each phase_run.status move pending -> running -> completed.
  for (const { phaseRunId, phaseId } of phaseRunIds) {
    void runJob('ResearchAiDraftJob', { studyId: study.id, phaseId, phaseRunId }).catch(err => {
      console.error(`[studies] ResearchAiDraftJob failed for phase_run ${phaseRunId}:`, err);
    });
  }
  // Also kick off the 2 real cross-portal jobs immediately for this study
  // (rather than waiting for their weekly cron schedule) so a freshly
  // created study's Pricing/Reviews phases get real data right away.
  void runJob('PricingCrossPortalJob', { studyId: study.id }).catch(err => console.error('[studies] PricingCrossPortalJob failed:', err));
  void runJob('ReviewsCrossPortalJob', { studyId: study.id }).catch(err => console.error('[studies] ReviewsCrossPortalJob failed:', err));

  return Response.json({ study, phaseRunCount: phaseRunIds.length }, { status: 201 });
}
