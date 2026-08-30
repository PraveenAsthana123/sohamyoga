import { NextRequest } from 'next/server';
import { requireAdmin } from '../../../../lib/session-auth';
import { runJob } from '../../../../domain/pipeline/runJob';
import { query } from '../../../../lib/postgres';

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  let body: { module?: string; studyId?: string; phaseSlug?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (!body.module) return Response.json({ error: 'module is required.' }, { status: 400 });

  const params: Record<string, unknown> = {};
  if (body.studyId) params.studyId = body.studyId;

  if (body.module === 'ResearchAiDraftJob') {
    if (!body.studyId || !body.phaseSlug) {
      return Response.json({ error: 'ResearchAiDraftJob requires studyId and phaseSlug.' }, { status: 400 });
    }
    const phaseRunResult = await query<{ id: string; phase_id: string }>(
      `SELECT pr.id, pr.phase_id FROM phase_run pr JOIN phase p ON p.id = pr.phase_id WHERE pr.study_id = $1 AND p.slug = $2`,
      [body.studyId, body.phaseSlug],
    );
    if (!phaseRunResult.rowCount) {
      return Response.json({ error: 'No phase_run found for that study/phase.' }, { status: 404 });
    }
    params.phaseId = phaseRunResult.rows[0].phase_id;
    params.phaseRunId = phaseRunResult.rows[0].id;
  }

  const result = await runJob(body.module, params);
  const httpStatus = result.status === 'succeeded' ? 200 : 500;
  return Response.json(result, { status: httpStatus });
}
