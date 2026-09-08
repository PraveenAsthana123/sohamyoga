// Real on-page SEO analysis of the app's own real rendered HTML — distinct
// from SeoReportJob, which depends on a Matomo deployment that doesn't
// exist here. This one needs no external service: it fetches a real page
// from this app and inspects real tags/content, never Matomo-derived data.
export interface OnPageCheck {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export interface OnPageSeoResult {
  url: string;
  score: number;
  checks: OnPageCheck[];
}

function firstMatch(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m ? m[1].trim() : null;
}

export function analyzeHtml(url: string, html: string): OnPageSeoResult {
  const checks: OnPageCheck[] = [];

  const title = firstMatch(html, /<title[^>]*>([^<]*)<\/title>/i);
  if (!title) {
    checks.push({ id: 'title', label: 'Title tag', status: 'fail', detail: 'No <title> tag found.' });
  } else if (title.length < 15 || title.length > 65) {
    checks.push({ id: 'title', label: 'Title tag', status: 'warn', detail: `Title is ${title.length} characters (recommended 15–65): "${title}"` });
  } else {
    checks.push({ id: 'title', label: 'Title tag', status: 'pass', detail: `"${title}" (${title.length} chars)` });
  }

  const metaDescription = firstMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i)
    ?? firstMatch(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i);
  if (!metaDescription) {
    checks.push({ id: 'meta_description', label: 'Meta description', status: 'fail', detail: 'No meta description found.' });
  } else if (metaDescription.length < 50 || metaDescription.length > 160) {
    checks.push({ id: 'meta_description', label: 'Meta description', status: 'warn', detail: `${metaDescription.length} characters (recommended 50–160).` });
  } else {
    checks.push({ id: 'meta_description', label: 'Meta description', status: 'pass', detail: `${metaDescription.length} characters.` });
  }

  const h1Matches = html.match(/<h1[^>]*>/gi) ?? [];
  if (h1Matches.length === 0) {
    checks.push({ id: 'h1', label: 'H1 heading', status: 'fail', detail: 'No <h1> found on the page.' });
  } else if (h1Matches.length > 1) {
    checks.push({ id: 'h1', label: 'H1 heading', status: 'warn', detail: `${h1Matches.length} <h1> tags found — should be exactly 1.` });
  } else {
    checks.push({ id: 'h1', label: 'H1 heading', status: 'pass', detail: 'Exactly one <h1>.' });
  }

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyHtml = bodyMatch ? bodyMatch[1] : html;
  const textOnly = bodyHtml.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ');
  const wordCount = (textOnly.match(/\b[a-zA-Z]{2,}\b/g) ?? []).length;
  if (wordCount < 100) {
    checks.push({ id: 'word_count', label: 'Content length', status: 'warn', detail: `Only ${wordCount} words of visible text — thin content.` });
  } else {
    checks.push({ id: 'word_count', label: 'Content length', status: 'pass', detail: `${wordCount} words of visible text.` });
  }

  const imgTags = html.match(/<img\b[^>]*>/gi) ?? [];
  const imgsMissingAlt = imgTags.filter(tag => !/\balt\s*=\s*["'][^"']*["']/i.test(tag) || /\balt\s*=\s*["']\s*["']/i.test(tag));
  if (imgTags.length === 0) {
    checks.push({ id: 'image_alt', label: 'Image alt text', status: 'pass', detail: 'No images on this page.' });
  } else if (imgsMissingAlt.length > 0) {
    checks.push({ id: 'image_alt', label: 'Image alt text', status: 'warn', detail: `${imgsMissingAlt.length} of ${imgTags.length} images have no/empty alt text.` });
  } else {
    checks.push({ id: 'image_alt', label: 'Image alt text', status: 'pass', detail: `All ${imgTags.length} images have alt text.` });
  }

  const canonical = firstMatch(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["'][^>]*>/i);
  checks.push(canonical
    ? { id: 'canonical', label: 'Canonical URL', status: 'pass', detail: canonical }
    : { id: 'canonical', label: 'Canonical URL', status: 'warn', detail: 'No canonical link tag found.' });

  const passWeight = 100 / checks.length;
  const score = Math.round(checks.reduce((sum, c) => sum + (c.status === 'pass' ? passWeight : c.status === 'warn' ? passWeight * 0.5 : 0), 0));

  return { url, score, checks };
}
