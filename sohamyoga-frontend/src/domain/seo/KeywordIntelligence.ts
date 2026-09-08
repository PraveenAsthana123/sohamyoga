export interface KeywordSuggestion {
  keyword: string;
  presentOnPage: boolean;
  opportunityScore: number;
}

export interface KeywordIntelligenceReport {
  seedKeyword: string;
  pageUrl: string;
  suggestions: KeywordSuggestion[];
  coveredCount: number;
  gapCount: number;
}

/** Real Google Suggest (autocomplete) API -- free, unauthenticated, public.
 * Returns real related search queries, NOT search-volume or competition
 * scores (those need a paid API this project doesn't have credentials
 * for -- fabricating volume numbers would misrepresent real data as
 * measured). This is an honest, narrower "keyword intelligence" signal:
 * what people actually search for related to a seed term. */
export async function fetchRelatedKeywords(seedKeyword: string): Promise<string[]> {
  const res = await fetch(
    `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(seedKeyword)}`,
    { signal: AbortSignal.timeout(8_000) }
  );
  if (!res.ok) throw new Error(`Google Suggest returned HTTP ${res.status}.`);
  const data = await res.json() as [string, string[]];
  return data[1] ?? [];
}

/** Real Keyword Opportunity Score -- Google Suggest returns terms already
 * ordered by its own relevance/frequency ranking (an ordinal signal Google
 * computes, not one this app invents), so an earlier position is a genuine
 * "more commonly searched" signal even without a numeric volume figure.
 * Score = that ordinal weight, zeroed out for keywords already covered on
 * the page (no opportunity if you already rank for it). Never presented as
 * a search-volume estimate -- purely a prioritization ordering. */
function opportunityScore(index: number, total: number, presentOnPage: boolean): number {
  if (presentOnPage) return 0;
  return Math.round(((total - index) / total) * 100);
}

/** Cross-references real suggested keywords against the page's own real
 * rendered text content -- flags which related terms are already covered
 * vs a genuine content gap, without inventing a difficulty/volume score. */
export function analyzeKeywordCoverage(seedKeyword: string, pageUrl: string, suggestions: string[], pageText: string): KeywordIntelligenceReport {
  const normalizedPageText = pageText.toLowerCase();
  const results: KeywordSuggestion[] = suggestions.map((keyword, index) => {
    const presentOnPage = normalizedPageText.includes(keyword.toLowerCase());
    return { keyword, presentOnPage, opportunityScore: opportunityScore(index, suggestions.length, presentOnPage) };
  });
  results.sort((a, b) => b.opportunityScore - a.opportunityScore);
  return {
    seedKeyword,
    pageUrl,
    suggestions: results,
    coveredCount: results.filter((r) => r.presentOnPage).length,
    gapCount: results.filter((r) => !r.presentOnPage).length,
  };
}
