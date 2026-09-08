import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { analyzeHtml } from '@/domain/seo/OnPageSeoChecker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real on-page SEO check — fetches the app's own real rendered HTML for a
// given path and analyzes real tags/content. No Matomo dependency, no
// external service; distinct from the Matomo-blocked SeoReportJob.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const path = req.nextUrl.searchParams.get('path');
  if (!path || !path.startsWith('/')) {
    return Response.json({ error: 'A path query param starting with / is required, e.g. ?path=/booking' }, { status: 400 });
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

  const result = analyzeHtml(`${origin}${path}`, html);
  return Response.json(result);
}
