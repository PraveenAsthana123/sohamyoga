import { NextRequest } from 'next/server';
import { requireAdmin } from '../../../lib/session-auth';
import { listPhases } from '../../../domain/pipeline/PipelineService';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const phases = await listPhases();
  return Response.json({ phases });
}
