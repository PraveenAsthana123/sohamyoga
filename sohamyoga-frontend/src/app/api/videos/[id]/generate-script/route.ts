import { NextRequest } from 'next/server';
import { databaseConfigured } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { generateVideoScript } from '@/domain/video/VideoScriptGenerator';
import { loadVideoAsset, saveVideoAssetState } from '@/domain/video/videoRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const video = await loadVideoAsset(params.id);
  if (!video) return Response.json({ error: 'Video not found.' }, { status: 404 });
  if (video.scriptStatus === 'approved') {
    return Response.json({ error: 'Script is already approved; cannot regenerate.' }, { status: 409 });
  }

  const { title, description, tags } = video.toJSON();
  const result = await generateVideoScript({ title, description, tags });
  if (!result) {
    return Response.json({ error: 'Ollama returned an invalid or unparseable script response.' }, { status: 502 });
  }

  let next;
  try {
    next = video.draftScript(result.script, result.hooks, new Date());
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Invalid transition.' }, { status: 409 });
  }
  await saveVideoAssetState(next);
  return Response.json({ ok: true, script: result.script, hooks: result.hooks, scriptStatus: next.scriptStatus });
}
