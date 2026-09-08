import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { suggestInternalLinks } from '@/domain/seo/InternalLinkingEngine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const path = req.nextUrl.searchParams.get('path') || '/';
  const origin = req.nextUrl.origin;

  try {
    const suggestions = await suggestInternalLinks(`${origin}${path}`, origin);
    return Response.json({ suggestions });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Could not analyze internal links.' }, { status: 502 });
  }
}
