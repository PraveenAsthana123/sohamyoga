import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DISCLAIMER = '\n\n---\n*DISCLAIMER: This product description is for retail staff reference and internal use only. All consumer-facing content must be reviewed for AGLC compliance before publication. Cannabis products are for adults 18+ in Alberta. No medical claims are made or implied.*';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const { brand, product_name, category, thc_pct, cbd_pct, weight_grams } = body;
  if (!brand || !product_name || !category) return Response.json({ error: 'brand, product_name, category required' }, { status: 400 });

  const prompt = `Write a compliant cannabis product description for an Alberta retailer. Product: ${brand} ${product_name}, ${category}, THC: ${thc_pct ?? 0}%, CBD: ${cbd_pct ?? 0}%. Weight: ${weight_grams ? weight_grams + 'g' : 'see packaging'}.
Include: sensory characteristics, effects profile (use effect language not medical claims), terpene notes if relevant, suggested use case, and storage recommendations.
IMPORTANT: Do not make health claims, do not target youth, use AGLC-compliant language. Alberta Cannabis Retail regulations compliant.
Keep it under 200 words. Professional retail tone.`;

  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = await res.json() as { response?: string };
    return Response.json({ description: (data.response || '') + DISCLAIMER, ai_generated: true });
  } catch {
    return Response.json({
      description: `${brand} ${product_name}\n\n${category.charAt(0).toUpperCase() + category.slice(1)} | THC: ${thc_pct ?? 0}% | CBD: ${cbd_pct ?? 0}%${weight_grams ? ' | ' + weight_grams + 'g' : ''}\n\nA quality cannabis product from ${brand}. Ask our knowledgeable staff for personalized recommendations.\n\nStorage: Keep in a cool, dry place away from direct sunlight. Keep out of reach of children and pets.` + DISCLAIMER,
      ai_generated: false,
      fallback: true,
    });
  }
}
