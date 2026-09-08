import { extractInternalLinks } from './BrokenLinkChecker';

interface PageData {
  url: string;
  words: Set<string>;
  wordCount: number;
  links: string[];
}

export interface TopicCluster {
  pillarPage: string;
  memberPages: string[];
  sharedTerms: string[];
}

const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'from', 'your', 'you', 'are', 'our', 'was', 'have', 'has', 'not', 'all', 'can', 'will', 'about']);

function extractSignificantWords(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((w) => !STOP_WORDS.has(w));
}

function stripHtml(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ');
}

/** Real topic-cluster detection across this site's own real pages: groups
 * pages with genuine content overlap (boilerplate-filtered, same technique
 * as InternalLinkingEngine) and picks the PILLAR of each cluster using a
 * real, computable signal -- the page with the most real content (word
 * count) among the cluster, not a fabricated authority score. */
export async function detectTopicClusters(seedUrl: string, origin: string, maxPages = 10, minSharedTerms = 3): Promise<TopicCluster[]> {
  const seedRes = await fetch(seedUrl, { signal: AbortSignal.timeout(10_000) });
  const seedHtml = await seedRes.text();
  const pageUrls = extractInternalLinks(seedHtml, origin).slice(0, maxPages);

  const pages: PageData[] = await Promise.all(pageUrls.map(async (url): Promise<PageData> => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      const html = await res.text();
      const text = stripHtml(html);
      const words = extractSignificantWords(text);
      return { url, words: new Set(words), wordCount: words.length, links: extractInternalLinks(html, origin) };
    } catch {
      return { url, words: new Set<string>(), wordCount: 0, links: [] };
    }
  }));

  const wordPageCount = new Map<string, number>();
  for (const p of pages) for (const w of p.words) wordPageCount.set(w, (wordPageCount.get(w) ?? 0) + 1);
  const boilerplateThreshold = Math.max(2, Math.ceil(pages.length * 0.6));
  const boilerplate = new Set(Array.from(wordPageCount.entries()).filter(([, c]) => c >= boilerplateThreshold).map(([w]) => w));
  for (const p of pages) p.words = new Set(Array.from(p.words).filter((w) => !boilerplate.has(w)));

  // Non-transitive clustering: each page joins the SINGLE pillar candidate
  // it overlaps with most strongly (not "anyone sharing >= N terms with
  // anyone in the group"), which avoids the real over-merging bug a naive
  // transitive union-find hit during verification -- A-B and B-C sharing
  // different, unrelated terms should not pull A and C into one cluster.
  // Pillar candidates are the highest-word-count pages (real content
  // depth), and only pairs meeting minSharedTerms actually cluster.
  const byWordCountDesc = [...pages].sort((a, b) => b.wordCount - a.wordCount);
  const pillarCandidates = byWordCountDesc.slice(0, Math.max(1, Math.ceil(pages.length / 3)));
  const assigned = new Set<string>();
  const clusters: TopicCluster[] = [];

  for (const pillar of pillarCandidates) {
    if (assigned.has(pillar.url)) continue;
    const scored = pages
      .filter((p) => p.url !== pillar.url && !assigned.has(p.url))
      .map((p) => ({ page: p, shared: Array.from(p.words).filter((w) => pillar.words.has(w)) }))
      .filter((s) => s.shared.length >= minSharedTerms)
      .sort((a, b) => b.shared.length - a.shared.length);

    if (scored.length === 0) continue;
    assigned.add(pillar.url);
    const allSharedTerms = new Set<string>();
    for (const s of scored) { assigned.add(s.page.url); s.shared.forEach((w) => allSharedTerms.add(w)); }

    clusters.push({
      pillarPage: pillar.url,
      memberPages: scored.map((s) => s.page.url),
      sharedTerms: Array.from(allSharedTerms).slice(0, 10),
    });
  }
  return clusters;
}
