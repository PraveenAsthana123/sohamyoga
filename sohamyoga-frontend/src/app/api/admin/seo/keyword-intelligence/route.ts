import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { fetchRelatedKeywords, analyzeKeywordCoverage } from '@/domain/seo/KeywordIntelligence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const path = req.nextUrl.searchParams.get('path');
  const seedKeyword = req.nextUrl.searchParams.get('keyword');
  if (!path || !path.startsWith('/')) {
    return Response.json({ error: 'A path query param starting with / is required.' }, { status: 400 });
  }
  if (!seedKeyword?.trim()) {
    return Response.json({ error: 'A keyword query param is required.' }, { status: 400 });
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
  const pageText = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ');

  try {
    const suggestions = await fetchRelatedKeywords(seedKeyword);
    const report = analyzeKeywordCoverage(seedKeyword, `${origin}${path}`, suggestions, pageText);
    return Response.json(report);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Could not fetch keyword suggestions.' }, { status: 502 });
  }
}
