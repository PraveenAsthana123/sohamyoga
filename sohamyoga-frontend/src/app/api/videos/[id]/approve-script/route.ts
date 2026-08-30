import { NextRequest } from 'next/server';
import { databaseConfigured } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { loadVideoAsset, saveVideoAssetState } from '@/domain/video/videoRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const video = await loadVideoAsset(params.id);
  if (!video) return Response.json({ error: 'Video not found.' }, { status: 404 });

  let next;
  try {
    next = video.approveScript(principal!.id, new Date());
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Invalid transition.' }, { status: 409 });
  }
  await saveVideoAssetState(next);
  return Response.json({ ok: true, scriptStatus: next.scriptStatus });
}
