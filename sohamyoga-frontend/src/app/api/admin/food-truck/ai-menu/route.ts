import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const body = await req.json();
  const { cuisine_type, truck_name } = body;

  if (!cuisine_type) return NextResponse.json({ error: 'cuisine_type required' }, { status: 400 });

  const prompt = `Create a food truck menu for a ${cuisine_type} food truck${truck_name ? ` called "${truck_name}"` : ''} in Calgary, Alberta. Target: street food, festival, and corporate catering events. Include: 4-6 main items, 2-3 sides, 2 drinks, 1 dessert. For each item include: name, brief description (2-3 words), price point ($10-20 range), key ingredients, dietary tags (vegan/GF/halal if applicable). Also suggest 1 seasonal special and 1 combo deal. Calgary food truck market context — busy summer festival season (Stampede, Folk Fest, Heritage Day).`;

  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) throw new Error('Ollama error');
    const data = await res.json();
    return NextResponse.json({ menu: data.response });
  } catch {
    return NextResponse.json({
      menu: `[AI service unavailable. Sample ${cuisine_type} menu concept:\n\nMains: Classic ${cuisine_type} Bowl ($14), Street Tacos x3 ($12), Signature Wrap ($13)\nSides: Fresh Salsa & Chips ($5), Street Corn ($4)\nDrinks: Agua Fresca ($4), Horchata ($4)\nDessert: Churros ($5)\nCombo: Main + Side + Drink ($18)]`,
      fallback: true,
    });
  }
}
