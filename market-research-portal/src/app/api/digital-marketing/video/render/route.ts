import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireAdmin } from '../../../../../lib/session-auth';
import { query } from '../../../../../lib/postgres';
import { renderVideoAsset } from '../../../../../domain/pipeline/VideoRenderer';
import { withApiErrorLog } from '../../../../../lib/api-error-log';

export const runtime = 'nodejs';

async function handlePost(req: NextRequest) {
  const denied = await requireAdmin(req); if (denied) return denied;
  const body = await req.json().catch(() => null) as any;
  if (!body?.title || !body?.script) return Response.json({ error: 'title and script required.' }, { status: 400 });
  if (String(body.script).length > 4000) return Response.json({ error: 'script exceeds 4000 characters.' }, { status: 400 });
  const w = await query<{ id: string }>(`SELECT id FROM marketing_workspace ORDER BY created_at LIMIT 1`);
  const workspaceId = w.rows[0]?.id;
  if (!workspaceId) return Response.json({ error: 'Workspace missing.' }, { status: 503 });

  const id = randomUUID();
  const title = String(body.title).slice(0, 160);
  const script = String(body.script);
  const campaignId = body.campaignId || null;

  const asset = await query<{ id: string }>(`INSERT INTO marketing_asset(id,workspace_id,campaign_id,asset_type,title,status,content,provider) VALUES($1,$2,$3,'video',$4,'generating',$5,'local espeak-ng + FFmpeg') RETURNING id`, [id, workspaceId, campaignId, title, script]);
  const job = await query<{ id: string }>(`INSERT INTO marketing_production_job(workspace_id,campaign_id,asset_id,job_type,status,started_at,attempts,idempotency_key,input) VALUES($1,$2,$3,'video_render','running',now(),1,$4,$5) RETURNING id`, [workspaceId, campaignId, id, `video:${id}`, JSON.stringify({ title, voice: 'espeak-ng' })]);

  const result = await renderVideoAsset({ assetId: id, workspaceId, campaignId, title, script, jobId: job.rows[0].id });
  if (result.status === 'failed') return Response.json({ error: result.errorMessage }, { status: 500 });
  return Response.json({ asset: { id: asset.rows[0].id, status: 'ready_for_review', filePath: result.filePath, durationSeconds: result.durationSeconds, checksum: result.checksum } }, { status: 201 });
}

export const POST = withApiErrorLog(handlePost);
