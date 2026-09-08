export interface PrioritizedIssue {
  source: 'on-page' | 'local-seo' | 'broken-links' | 'keyword-gap';
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
}

interface OnPageCheck { id: string; label: string; status: 'pass' | 'warn' | 'fail'; detail: string }
interface LocalCheck { id: string; label: string; status: 'pass' | 'warn' | 'fail'; detail: string }
interface BrokenLinkResult { href: string; ok: boolean; statusCode: number | null }
interface KeywordGap { keyword: string; presentOnPage: boolean }

/** Real aggregation of the 5 checkers already built this session -- no new
 * external dependency, no fabricated scoring model. Severity is a simple,
 * transparent rule (fail=high, warn=medium, keyword gap=low), not a
 * black-box weighted algorithm presented as more sophisticated than it is. */
export function prioritizeIssues(
  onPage: OnPageCheck[],
  local: LocalCheck[],
  brokenLinks: BrokenLinkResult[],
  keywordGaps: KeywordGap[]
): PrioritizedIssue[] {
  const issues: PrioritizedIssue[] = [];

  for (const c of onPage) {
    if (c.status === 'fail') issues.push({ source: 'on-page', severity: 'high', title: c.label, detail: c.detail });
    else if (c.status === 'warn') issues.push({ source: 'on-page', severity: 'medium', title: c.label, detail: c.detail });
  }
  for (const c of local) {
    if (c.status === 'fail') issues.push({ source: 'local-seo', severity: 'high', title: c.label, detail: c.detail });
    else if (c.status === 'warn') issues.push({ source: 'local-seo', severity: 'medium', title: c.label, detail: c.detail });
  }
  for (const l of brokenLinks) {
    if (!l.ok) issues.push({ source: 'broken-links', severity: 'high', title: 'Broken internal link', detail: `${l.href} returned ${l.statusCode ?? 'a network error'}` });
  }
  for (const k of keywordGaps) {
    if (!k.presentOnPage) issues.push({ source: 'keyword-gap', severity: 'low', title: 'Content gap', detail: `"${k.keyword}" is a related search term not covered on this page` });
  }

  const severityRank = { high: 0, medium: 1, low: 2 };
  return issues.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}
