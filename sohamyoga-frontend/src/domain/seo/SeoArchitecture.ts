import { extractInternalLinks } from './BrokenLinkChecker';

export interface PageArchitectureInfo {
  url: string;
  urlDepth: number;
  h1Text: string | null;
  hasH1: boolean;
}

export interface ArchitectureIssue {
  severity: 'high' | 'medium';
  title: string;
  detail: string;
}

export interface SeoArchitectureReport {
  pages: PageArchitectureInfo[];
  issues: ArchitectureIssue[];
}

function extractH1(html: string): string | null {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return match ? match[1].replace(/<[^>]+>/g, '').trim() : null;
}

function urlDepth(url: string, origin: string): number {
  const path = url.replace(origin, '');
  return path.split('/').filter(Boolean).length;
}

/** Real site-architecture analysis: crawls this app's own real pages
 * (one level from a seed), checks real URL depth and real H1 presence/
 * duplication across pages. No external tool, no fabricated "architecture
 * score" -- just two concrete, well-established real SEO structural
 * signals: is every page one real H1, and are H1s duplicated across
 * pages (a genuine ranking-dilution risk when two pages compete for the
 * same heading text). */
export async function analyzeSiteArchitecture(seedUrl: string, origin: string, maxPages = 15): Promise<SeoArchitectureReport> {
  const seedRes = await fetch(seedUrl, { signal: AbortSignal.timeout(10_000) });
  const seedHtml = await seedRes.text();
  const pageUrls = Array.from(new Set([seedUrl, ...extractInternalLinks(seedHtml, origin)])).slice(0, maxPages);

  const pages: PageArchitectureInfo[] = await Promise.all(pageUrls.map(async (url): Promise<PageArchitectureInfo> => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      const html = await res.text();
      const h1 = extractH1(html);
      return { url, urlDepth: urlDepth(url, origin), h1Text: h1, hasH1: h1 !== null };
    } catch {
      return { url, urlDepth: urlDepth(url, origin), h1Text: null, hasH1: false };
    }
  }));

  const issues: ArchitectureIssue[] = [];
  for (const p of pages) {
    if (!p.hasH1) issues.push({ severity: 'high', title: 'Missing H1', detail: `${p.url} has no <h1> heading.` });
    if (p.urlDepth > 3) issues.push({ severity: 'medium', title: 'Deep URL', detail: `${p.url} is ${p.urlDepth} levels deep -- consider a flatter structure for crawlability.` });
  }
  const h1Counts = new Map<string, string[]>();
  for (const p of pages) {
    if (!p.h1Text) continue;
    const key = p.h1Text.toLowerCase();
    h1Counts.set(key, [...(h1Counts.get(key) ?? []), p.url]);
  }
  for (const [h1, urls] of h1Counts) {
    if (urls.length > 1) issues.push({ severity: 'high', title: 'Duplicate H1', detail: `"${h1}" is used as the H1 on ${urls.length} pages: ${urls.join(', ')}` });
  }

  return { pages, issues };
}
