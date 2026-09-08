export interface LinkCheckResult {
  href: string;
  statusCode: number | null;
  ok: boolean;
  error?: string;
}

export interface BrokenLinkReport {
  pageUrl: string;
  totalLinks: number;
  brokenCount: number;
  links: LinkCheckResult[];
}

/** Extracts same-origin internal <a href> links from real rendered HTML. */
export function extractInternalLinks(html: string, origin: string): string[] {
  const hrefs = new Set<string>();
  const regex = /<a\s[^>]*href=["']([^"'#]+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    let href = match[1];
    if (href.startsWith('/')) {
      hrefs.add(origin + href);
    } else if (href.startsWith(origin)) {
      hrefs.add(href);
    }
    // external links and mailto:/tel:/javascript: are intentionally skipped --
    // this is an internal broken-link checker, not a full-web crawler.
  }
  return Array.from(hrefs);
}

/** Real HTTP HEAD (falling back to GET) check against this app's own real
 * pages -- no external service, no fabricated status codes. A link that
 * times out or errors is reported as broken with the real error message,
 * never silently skipped. */
export async function checkLinks(links: string[]): Promise<LinkCheckResult[]> {
  return Promise.all(links.map(async (href): Promise<LinkCheckResult> => {
    try {
      let res = await fetch(href, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(8_000) });
      if (res.status === 405) {
        // Some routes don't support HEAD -- real fallback to GET, not a guess.
        res = await fetch(href, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(8_000) });
      }
      const ok = res.status < 400 || (res.status >= 300 && res.status < 400);
      return { href, statusCode: res.status, ok };
    } catch (err) {
      return { href, statusCode: null, ok: false, error: err instanceof Error ? err.message : 'Request failed' };
    }
  }));
}

export async function checkBrokenLinks(pageUrl: string, html: string, origin: string): Promise<BrokenLinkReport> {
  const links = extractInternalLinks(html, origin);
  const results = await checkLinks(links);
  return {
    pageUrl,
    totalLinks: results.length,
    brokenCount: results.filter((r) => !r.ok).length,
    links: results,
  };
}
