// Real local-SEO / GEO structured-data analysis of the app's own rendered
// HTML. Distinct from AI-answer-engine citation tracking (ChatGPT/Gemini/
// Perplexity visibility monitoring) -- that genuinely needs external API
// credentials this environment doesn't have and is NOT attempted here. This
// checks the part that needs no external service: whether the page carries
// valid schema.org LocalBusiness structured data, and whether the phone
// number in that structured data agrees with the phone number visible in
// the page's own text (a real NAP-consistency check, not a comparison
// against the `branch` table, which currently has zero real rows).
export interface LocalSeoCheck {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export interface LocalSeoResult {
  url: string;
  score: number;
  checks: LocalSeoCheck[];
}

interface LocalBusinessSchema {
  '@type'?: string | string[];
  name?: string;
  address?: unknown;
  telephone?: string;
  openingHours?: unknown;
}

function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(m[1].trim()));
    } catch {
      // malformed JSON-LD block -- ignored, surfaced via the schema-presence check instead
    }
  }
  return blocks;
}

function findLocalBusiness(blocks: unknown[]): LocalBusinessSchema | null {
  for (const block of blocks) {
    const candidates = Array.isArray(block) ? block : [block];
    for (const c of candidates) {
      if (!c || typeof c !== 'object') continue;
      const obj = c as LocalBusinessSchema;
      const type = obj['@type'];
      const types = Array.isArray(type) ? type : [type];
      if (types.some(t => typeof t === 'string' && t.toLowerCase().includes('localbusiness'))) return obj;
    }
  }
  return null;
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

export function analyzeLocalSeo(url: string, html: string): LocalSeoResult {
  const checks: LocalSeoCheck[] = [];

  const jsonLdBlocks = extractJsonLdBlocks(html);
  const business = findLocalBusiness(jsonLdBlocks);

  if (!business) {
    checks.push({
      id: 'local_business_schema',
      label: 'LocalBusiness structured data',
      status: 'fail',
      detail: 'No schema.org LocalBusiness (or subtype) JSON-LD block found on this page.',
    });
  } else {
    checks.push({
      id: 'local_business_schema',
      label: 'LocalBusiness structured data',
      status: 'pass',
      detail: `Found a LocalBusiness JSON-LD block${business.name ? ` for "${business.name}"` : ''}.`,
    });

    const hasName = typeof business.name === 'string' && business.name.trim().length > 0;
    const hasAddress = business.address != null && (typeof business.address !== 'object' || Object.keys(business.address as object).length > 0);
    const hasPhone = typeof business.telephone === 'string' && business.telephone.trim().length > 0;
    const missing = [!hasName && 'name', !hasAddress && 'address', !hasPhone && 'telephone'].filter(Boolean);
    checks.push(missing.length
      ? { id: 'nap_fields', label: 'Name/Address/Phone fields', status: 'warn', detail: `Schema is missing: ${missing.join(', ')}.` }
      : { id: 'nap_fields', label: 'Name/Address/Phone fields', status: 'pass', detail: 'Schema includes name, address, and telephone.' });

    if (hasPhone) {
      const schemaDigits = digitsOnly(business.telephone as string);
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      const textOnly = (bodyMatch ? bodyMatch[1] : html).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ');
      const phoneCandidates = textOnly.match(/(\+?\d[\d\s().-]{7,}\d)/g) ?? [];
      const matches = phoneCandidates.some(c => digitsOnly(c).endsWith(schemaDigits.slice(-7)));
      checks.push(matches
        ? { id: 'nap_consistency', label: 'Phone number consistency', status: 'pass', detail: 'The phone number in structured data also appears in the visible page text.' }
        : { id: 'nap_consistency', label: 'Phone number consistency', status: 'warn', detail: 'The structured-data phone number was not found anywhere in the visible page text.' });
    }
  }

  checks.push({
    id: 'ai_answer_visibility',
    label: 'AI-answer-engine visibility (ChatGPT/Gemini/Perplexity)',
    status: 'warn',
    detail: 'Not checked -- citation tracking on AI answer engines needs external API credentials this app does not have. Deliberately out of scope, not fabricated.',
  });

  const scored = checks.filter(c => c.id !== 'ai_answer_visibility');
  const passWeight = 100 / scored.length;
  const score = Math.round(scored.reduce((sum, c) => sum + (c.status === 'pass' ? passWeight : c.status === 'warn' ? passWeight * 0.5 : 0), 0));

  return { url, score, checks };
}
