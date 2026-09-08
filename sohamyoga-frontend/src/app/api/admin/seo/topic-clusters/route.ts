import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { detectTopicClusters } from '@/domain/seo/TopicClusterEngine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const path = req.nextUrl.searchParams.get('path') || '/';
  const origin = req.nextUrl.origin;

  try {
    const clusters = await detectTopicClusters(`${origin}${path}`, origin);
    return Response.json({ clusters });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Could not detect topic clusters.' }, { status: 502 });
  }
}
