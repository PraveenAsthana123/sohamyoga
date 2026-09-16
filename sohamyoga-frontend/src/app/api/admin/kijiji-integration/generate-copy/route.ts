import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as {
    title?: string; category?: string; key_features?: string;
    price?: number; location?: string;
  } | null;

  if (!body?.title || !body?.category) {
    return Response.json({ error: 'title and category are required' }, { status: 400 });
  }

  const priceStr = body.price != null
    ? `$${body.price.toFixed(2)}`
    : 'Please contact for price';

  const prompt = `You are an expert Kijiji.ca classified ad copywriter for Canada. Write an optimized Kijiji ad description (300-400 words) for the following listing.

Listing Details:
- Title: ${body.title}
- Category: ${body.category}
- Key Features: ${body.key_features ?? 'not specified'}
- Price: ${priceStr}
- Location: ${body.location ?? 'Ontario, Canada'}

Structure the ad with:
1. A catchy opening sentence (1-2 sentences) that grabs attention
2. A "What You Get" or "Key Features" bullet list (4-6 bullets using - )
3. A short paragraph on condition/quality and why to buy from us
4. A clear call-to-action with placeholder text like "[Your Name]" and "[Your Phone/Email]"

Write in a professional but friendly Canadian tone. Do not use markdown headers — just plain paragraphs and bullets. Do not include the price or location in the body (those are separate Kijiji fields). Output only the ad body text.`;

  try {
    const resp = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2',
        prompt,
        stream: false,
        options: { temperature: 0.7, num_predict: 600 },
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error('[kijiji/generate-copy] Ollama error:', err);
      return Response.json({ description: '', error: 'Ollama unavailable' }, { status: 200 });
    }

    const data = await resp.json() as { response?: string };
    const description = (data.response ?? '').trim();
    return Response.json({ description });
  } catch (err) {
    console.error('[kijiji/generate-copy] Ollama fetch failed:', err);
    return Response.json({ description: '', error: 'Ollama unavailable' }, { status: 200 });
  }
}
