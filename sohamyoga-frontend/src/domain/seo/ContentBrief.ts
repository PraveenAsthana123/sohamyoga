import { fetchRelatedKeywords } from './KeywordIntelligence';

export interface ContentBrief {
  seedKeyword: string;
  suggestedTitle: string;
  suggestedHeadings: string[];
  relatedTermsToInclude: string[];
}

/** Real content brief -- grounded entirely in real Google Suggest related
 * queries (same free API as Keyword Intelligence). No fabricated
 * competitor word-count target or "ideal length" number, since that would
 * need real competitor-content analysis this project has no data source
 * for. What IS real and useful: a suggested title/heading structure built
 * directly from what people actually search for around this topic. */
export async function generateContentBrief(seedKeyword: string): Promise<ContentBrief> {
  const related = await fetchRelatedKeywords(seedKeyword);
  const capitalizedSeed = seedKeyword.replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    seedKeyword,
    suggestedTitle: `${capitalizedSeed}: A Complete Guide`,
    suggestedHeadings: [
      `What is ${seedKeyword}?`,
      ...related.slice(0, 5).map((term) => term.replace(/\b\w/g, (c) => c.toUpperCase())),
      'Frequently Asked Questions',
    ],
    relatedTermsToInclude: related,
  };
}
