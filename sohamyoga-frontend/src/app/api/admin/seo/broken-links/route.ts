import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { checkBrokenLinks } from '@/domain/seo/BrokenLinkChecker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real broken-link check against this app's own real rendered page --
// fetches the page, extracts real internal <a href> links, and issues a
// real HTTP request to each to find genuine 4xx/5xx/network-error links.
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

  const report = await checkBrokenLinks(`${origin}${path}`, html, origin);
  return Response.json(report);
}
