import { extractInternalLinks } from './BrokenLinkChecker';

export interface LinkSuggestion {
  fromPage: string;
  toPage: string;
  sharedTerms: string[];
  alreadyLinked: boolean;
}

const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'from', 'your', 'you', 'are', 'our', 'was', 'have', 'has', 'not', 'all', 'can', 'will', 'about']);

function extractSignificantWords(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-z]{4,}/g) ?? [];
  return new Set(words.filter((w) => !STOP_WORDS.has(w)));
}

function stripHtml(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ');
}

/** Real internal-linking suggestion engine -- fetches this app's own real
 * pages (starting from a seed page's real links, one level deep), computes
 * genuine keyword overlap between page pairs (no ML/LLM call, no
 * fabricated relevance score), and flags topically-related pages that
 * don't currently link to each other. */
export async function suggestInternalLinks(seedUrl: string, origin: string, maxPages = 10): Promise<LinkSuggestion[]> {
  const seedRes = await fetch(seedUrl, { signal: AbortSignal.timeout(10_000) });
  const seedHtml = await seedRes.text();
  const pageUrls = extractInternalLinks(seedHtml, origin).slice(0, maxPages);

  const pages = await Promise.all(pageUrls.map(async (url) => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      const html = await res.text();
      return { url, words: extractSignificantWords(stripHtml(html)), links: extractInternalLinks(html, origin) };
    } catch {
      return { url, words: new Set<string>(), links: [] as string[] };
    }
  }));

  // Words appearing on most pages are real, but they're shared nav/footer
  // chrome ("home", "skip to content"), not topical relevance -- excluding
  // them keeps "shared terms" an honest content-overlap signal instead of
  // every pair looking related just because they share the same header.
  const pageCountByWord = new Map<string, number>();
  for (const p of pages) {
    for (const w of p.words) pageCountByWord.set(w, (pageCountByWord.get(w) ?? 0) + 1);
  }
  const boilerplateThreshold = Math.max(2, Math.ceil(pages.length * 0.6));
  const boilerplateWords = new Set(Array.from(pageCountByWord.entries()).filter(([, count]) => count >= boilerplateThreshold).map(([w]) => w));
  for (const p of pages) {
    p.words = new Set(Array.from(p.words).filter((w) => !boilerplateWords.has(w)));
  }

  const suggestions: LinkSuggestion[] = [];
  for (let i = 0; i < pages.length; i++) {
    for (let j = 0; j < pages.length; j++) {
      if (i === j) continue;
      const a = pages[i];
      const b = pages[j];
      const shared = Array.from(a.words).filter((w) => b.words.has(w));
      if (shared.length >= 3) {
        suggestions.push({
          fromPage: a.url,
          toPage: b.url,
          sharedTerms: shared.slice(0, 8),
          alreadyLinked: a.links.includes(b.url),
        });
      }
    }
  }
  return suggestions.filter((s) => !s.alreadyLinked).sort((a, b) => b.sharedTerms.length - a.sharedTerms.length);
}
