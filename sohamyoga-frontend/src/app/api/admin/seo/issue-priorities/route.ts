import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { analyzeHtml } from '@/domain/seo/OnPageSeoChecker';
import { analyzeLocalSeo } from '@/domain/seo/LocalSeoChecker';
import { checkBrokenLinks } from '@/domain/seo/BrokenLinkChecker';
import { fetchRelatedKeywords, analyzeKeywordCoverage } from '@/domain/seo/KeywordIntelligence';
import { prioritizeIssues } from '@/domain/seo/IssuePrioritization';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real aggregation -- runs the 4 existing real checkers against the same
// real page and merges their findings into one prioritized list. No new
// external dependency; every finding traces back to an already-verified
// checker.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const path = req.nextUrl.searchParams.get('path');
  const keyword = req.nextUrl.searchParams.get('keyword');
  if (!path || !path.startsWith('/')) {
    return Response.json({ error: 'A path query param starting with / is required.' }, { status: 400 });
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

  const onPageResult = analyzeHtml(`${origin}${path}`, html);
  const localResult = analyzeLocalSeo(`${origin}${path}`, html);
  const brokenLinksResult = await checkBrokenLinks(`${origin}${path}`, html, origin);

  let keywordGaps: { keyword: string; presentOnPage: boolean }[] = [];
  if (keyword?.trim()) {
    try {
      const suggestions = await fetchRelatedKeywords(keyword);
      const pageText = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ');
      keywordGaps = analyzeKeywordCoverage(keyword, `${origin}${path}`, suggestions, pageText).suggestions;
    } catch {
      // Keyword check is optional here -- if Google Suggest is unreachable, still return the other 3 checkers' findings rather than failing the whole request.
    }
  }

  const issues = prioritizeIssues(onPageResult.checks, localResult.checks, brokenLinksResult.links, keywordGaps);
  return Response.json({ issues, totalIssues: issues.length });
}
