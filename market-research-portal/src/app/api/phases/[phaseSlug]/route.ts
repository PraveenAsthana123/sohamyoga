import { NextRequest } from 'next/server';
import { requireAdmin } from '../../../../lib/session-auth';
import { getPhaseBySlug, getChecklistTemplatesForPhaseSlug } from '../../../../domain/pipeline/PipelineService';

export async function GET(req: NextRequest, { params }: { params: { phaseSlug: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const phase = await getPhaseBySlug(params.phaseSlug);
  if (!phase) return Response.json({ error: `Phase "${params.phaseSlug}" not found.` }, { status: 404 });
  const checklistTemplates = await getChecklistTemplatesForPhaseSlug(params.phaseSlug);
  return Response.json({ phase, checklistTemplates });
}
