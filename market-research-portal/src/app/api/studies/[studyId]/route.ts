import { NextRequest } from 'next/server';
import { requireAdmin } from '../../../../lib/session-auth';
import { getStudy, getStudyPhaseRuns } from '../../../../domain/pipeline/PipelineService';

export async function GET(req: NextRequest, { params }: { params: { studyId: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const study = await getStudy(params.studyId);
  if (!study) return Response.json({ error: `Study "${params.studyId}" not found.` }, { status: 404 });

  const phaseRuns = await getStudyPhaseRuns(params.studyId);
  return Response.json({ study, phaseRuns });
}
