import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { analyzeSiteArchitecture } from '@/domain/seo/SeoArchitecture';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const path = req.nextUrl.searchParams.get('path') || '/';
  const origin = req.nextUrl.origin;

  try {
    const report = await analyzeSiteArchitecture(`${origin}${path}`, origin);
    return Response.json(report);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Could not analyze site architecture.' }, { status: 502 });
  }
}
