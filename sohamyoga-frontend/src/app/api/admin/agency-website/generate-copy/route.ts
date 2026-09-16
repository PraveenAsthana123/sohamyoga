export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const { section, tone, keywords } = body;
  if (!section) return Response.json({ error: 'section required' }, { status: 400 });

  const toneDesc: Record<string, string> = {
    professional: 'formal, authoritative, and trustworthy',
    casual: 'friendly, approachable, and conversational',
    bold: 'confident, punchy, and energetic',
  };
  const toneText = toneDesc[tone] || 'professional';
  const keywordText = keywords ? ` Naturally weave in these keywords: ${keywords}.` : '';

  const sectionPrompts: Record<string, string> = {
    hero: `Write a compelling hero section for a marketing agency website. Include: a powerful headline (max 10 words), a subheadline (max 20 words), and a 2-sentence value proposition.${keywordText} Tone: ${toneText}.`,
    about: `Write an "About Us" section for a digital marketing agency. Include: company origin story (2-3 sentences), mission statement (1-2 sentences), core values (3-4 bullet points), and team highlight (1-2 sentences).${keywordText} Tone: ${toneText}.`,
    services: `Write a "Services" section for a full-service marketing agency. List 5-6 services with: service name, one-line description, and key benefit. Services should cover SEO, paid ads, social media, content marketing, email marketing, and analytics.${keywordText} Tone: ${toneText}.`,
    pricing: `Write a pricing section for a marketing agency. Create 3 pricing tiers (Starter, Growth, Enterprise) with: tier name, monthly price range, 4-5 included services per tier, and a CTA button label. Use clear, conversion-optimized language.${keywordText} Tone: ${toneText}.`,
    testimonials: `Write 3 realistic client testimonials for a marketing agency. Each should include: client quote (2-3 sentences), client name, company, and results achieved (e.g. "increased leads by 40%").${keywordText} Tone: ${toneText}.`,
    cta: `Write a strong call-to-action section for a marketing agency website. Include: headline (max 8 words), supporting copy (1-2 sentences), primary CTA button text, and secondary CTA link text.${keywordText} Tone: ${toneText}.`,
  };

  const prompt = sectionPrompts[section] || `Write compelling website copy for the "${section}" section of a marketing agency. Tone: ${toneText}.${keywordText}`;

  try {
    const r = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    const d = await r.json();
    return Response.json({ copy: d.response || '', section, tone, keywords });
  } catch {
    return Response.json({ error: 'AI service unavailable' }, { status: 503 });
  }
}
