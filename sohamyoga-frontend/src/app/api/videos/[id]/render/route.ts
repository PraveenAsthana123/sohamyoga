import { NextRequest } from 'next/server';
import { databaseConfigured } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { loadVideoAsset, saveVideoAssetState } from '@/domain/video/videoRepository';
import { renderVideoAsset } from '@/domain/video/VideoRenderer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const video = await loadVideoAsset(params.id);
  if (!video) return Response.json({ error: 'Video not found.' }, { status: 404 });

  let rendering;
  try {
    rendering = video.queueRender(new Date()).beginRendering(new Date());
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Invalid transition.' }, { status: 409 });
  }

  const { title, script } = rendering.toJSON();
  if (!script) return Response.json({ error: 'No script found for this video.' }, { status: 409 });

  await saveVideoAssetState(rendering);

  // Fires the real espeak-ng/FFmpeg pipeline in the background — can take
  // minutes, so the HTTP response doesn't block on it. renderVideoAsset
  // writes the terminal render_status ('complete'/'failed') itself when
  // done; the admin UI polls GET /api/videos for the current state.
  void renderVideoAsset({ assetId: params.id, title, script }).catch((err) => {
    console.error(`[render-route] asset ${params.id}:`, err);
  });

  return Response.json({ ok: true, renderStatus: rendering.renderStatus }, { status: 202 });
}
