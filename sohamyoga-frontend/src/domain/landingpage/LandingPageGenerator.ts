import { ollama } from '../../cron/OllamaClient';

// Prompt-to-website generation: one prompt produces a real draft landing_page
// row (title/headline/subheadline/body/SEO fields), reusing the existing
// landing_page table and its real publish/version lifecycle rather than
// inventing a parallel "generated page" concept. Closes the use_case_registry
// gap "Prompt-to-website generation, general landing page builder" -- scoped
// to text content generation, since a drag-and-drop visual builder is a
// separate, much larger feature this app doesn't have.
//
// Uses a delimited plain-text format rather than JSON: the multi-paragraph
// bodyMarkdown field (with its own embedded newlines/markdown) reliably
// broke JSON.parse on the local strong-tier model (llama3.2:3b emitted
// YAML-style `|` block scalars instead of a valid JSON string). Same
// delimited-field pattern already proven in CampaignContentGenerator.ts.
export interface GeneratedLandingPage {
  title: string;
  headline: string;
  subheadline: string;
  bodyMarkdown: string;
  seoTitle: string;
  seoDescription: string;
}

const SYSTEM = `You are a marketing copywriter drafting a landing page for a yoga studio.
Given a one-line brief, write real landing-page copy. Return your answer in EXACTLY this format,
one field per line except BODY which may span multiple lines, no markdown fences, no extra prose:
TITLE: <internal page title, <=60 chars>
HEADLINE: <the big on-page headline, <=70 chars>
SUBHEADLINE: <=140 chars>
SEO_TITLE: <=60 chars>
SEO_DESCRIPTION: <=160 chars>
BODY:
<2-4 short paragraphs of Markdown body copy>`;

function extractField(text: string, label: string): string {
  const re = new RegExp(`^${label}:\\s*(.+)$`, 'im');
  return text.match(re)?.[1]?.trim() ?? '';
}

function parseDraft(raw: string): GeneratedLandingPage | null {
  const text = raw.replace(/```[a-z]*\n?/gi, '').trim();
  const bodyMatch = text.match(/BODY:\s*([\s\S]+)/i);
  const draft: GeneratedLandingPage = {
    title: extractField(text, 'TITLE'),
    headline: extractField(text, 'HEADLINE'),
    subheadline: extractField(text, 'SUBHEADLINE'),
    seoTitle: extractField(text, 'SEO_TITLE'),
    seoDescription: extractField(text, 'SEO_DESCRIPTION'),
    bodyMarkdown: bodyMatch?.[1]?.trim() ?? '',
  };
  if (!draft.title || !draft.headline || !draft.bodyMarkdown) return null;
  return draft;
}

// The local strong-tier model occasionally drifts from the requested format
// (~1/3 of calls observed) -- one retry before failing is cheap and matches
// realistic "regenerate" UX for AI content tools, rather than over-engineering
// an unbounded retry loop for a small local model.
export async function generateLandingPageDraft(brief: string): Promise<GeneratedLandingPage> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await ollama.generate(`Brief: ${brief}`, {
      tier: 'strong', system: SYSTEM, maxTokens: 700, timeoutMs: 60_000,
    });
    const draft = parseDraft(raw);
    if (draft) return draft;
  }
  throw new Error('Ollama response was missing required landing-page fields after 2 attempts.');
}

export function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'page';
}
