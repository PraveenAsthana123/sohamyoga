import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { analyzeLocalSeo } from '@/domain/seo/LocalSeoChecker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real local-SEO / GEO structured-data check — fetches the app's own real
// rendered HTML for a given path and inspects it for schema.org
// LocalBusiness JSON-LD and NAP consistency. No external service call.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const path = req.nextUrl.searchParams.get('path');
  if (!path || !path.startsWith('/')) {
    return Response.json({ error: 'A path query param starting with / is required, e.g. ?path=/' }, { status: 400 });
  }

  const origin = req.nextUrl.origin;
  let html: string;
  try {
    const res = await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return Response.json({ error: `The page returned HTTP ${res.status}.` }, { status: 502 });
    html = await res.text();
  } catch {
    return Response.json({ error: 'Could not fetch the page.' }, { status: 502 });
  }

  const result = analyzeLocalSeo(`${origin}${path}`, html);
  return Response.json(result);
}
