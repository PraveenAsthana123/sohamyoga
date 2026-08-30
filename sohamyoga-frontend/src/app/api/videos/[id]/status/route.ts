import { NextRequest } from 'next/server';
import { databaseConfigured } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { type VideoAsset } from '@/domain/video/VideoAsset';
import { loadVideoAsset, saveVideoAssetState } from '@/domain/video/videoRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { action?: 'publish' | 'archive' } | null;
  if (!body?.action || !['publish', 'archive'].includes(body.action)) {
    return Response.json({ error: 'action must be "publish" or "archive".' }, { status: 400 });
  }

  const video = await loadVideoAsset(params.id);
  if (!video) return Response.json({ error: 'Video not found.' }, { status: 404 });

  let next: VideoAsset;
  try {
    next = body.action === 'publish' ? video.publish() : video.archive();
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Invalid transition.' }, { status: 409 });
  }

  await saveVideoAssetState(next);
  return Response.json({ ok: true, status: next.status });
}
