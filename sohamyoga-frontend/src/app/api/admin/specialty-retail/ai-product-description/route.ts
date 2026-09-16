import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const prompt = `Write a compelling retail product description for: ${body.name || 'product'} by ${body.brand || 'our brand'}. Category: ${body.category || 'general'}. Cost: $${body.cost_price}, Retail: $${body.retail_price}. Key features: ${body.description || 'high-quality specialty product'}. Target: specialty boutique shoppers in Calgary. Include: headline (10 words), features as bullet points, emotional selling statement, and SEO-friendly product blurb (80 words). Tone: enthusiastic but authentic.`;
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json();
      return NextResponse.json({ description: data.response, generated_by: 'ollama' });
    } catch {
      return NextResponse.json({
        description: `**${body.name || 'Premium Product'} — Elevate Your Everyday Experience**\n\n• Premium quality ${body.category || 'specialty'} crafted for discerning shoppers\n• ${body.brand || 'Curated brand'} — trusted for quality and value\n• Perfect for everyday use and gifting\n• Available exclusively at our Calgary boutique\n\n*Discover the difference quality makes.* This exceptional ${body.name || 'item'} brings together style and function in a way that speaks to those who appreciate the finer things. Priced at $${body.retail_price}, it delivers outstanding value for the quality you receive.\n\n*AI service temporarily offline — customize before publishing.*`,
        generated_by: 'fallback',
      });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
