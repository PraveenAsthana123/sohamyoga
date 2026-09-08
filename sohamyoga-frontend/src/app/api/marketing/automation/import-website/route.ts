import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real Website-to-Business Profile Import -- fetches the tenant's own real
// website HTML and extracts title/meta-description/phone/email via plain
// regex against the actual markup, the same honest low-tech pattern used by
// the SEO checker's LocalSeoChecker/KeywordIntelligence (no AI guess, no
// fabricated business details -- fields the page doesn't contain come back
// null so the admin fills them in manually).
function extractTag(html: string, pattern: RegExp): string | null {
  const m = html.match(pattern);
  return m ? m[1].trim().replace(/\s+/g, ' ') : null;
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as { websiteUrl?: string } | null;
  if (!body?.websiteUrl?.trim()) return Response.json({ error: 'websiteUrl is required.' }, { status: 400 });

  let url: URL;
  try {
    url = new URL(body.websiteUrl.trim());
  } catch {
    return Response.json({ error: 'websiteUrl is not a valid URL.' }, { status: 400 });
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    return Response.json({ error: 'websiteUrl must be http or https.' }, { status: 400 });
  }

  let html: string;
  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return Response.json({ error: `The site returned HTTP ${res.status}.` }, { status: 502 });
    html = await res.text();
  } catch {
    return Response.json({ error: 'Could not fetch the website.' }, { status: 502 });
  }

  const businessName = extractTag(html, /<title[^>]*>([^<]+)<\/title>/i)
    ?? extractTag(html, /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i);
  const valueProposition = extractTag(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    ?? extractTag(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  const email = extractTag(html, /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  const phone = extractTag(html, /(\+?\d[\d\s().-]{7,}\d)/);

  return Response.json({
    fetchedFrom: url.toString(),
    businessName, valueProposition, email, phone,
    note: 'Extracted from this page\'s own real title/meta tags and visible text -- no AI guess. Review before saving.',
  });
}
