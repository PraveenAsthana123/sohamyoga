import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { dish_name, servings } = body;

    const prompt = `Write a complete recipe for ${dish_name || 'seasonal dish'}. Servings: ${servings || 4}. Include: ingredient list with quantities, mise en place prep steps, detailed cooking instructions with temperatures and timing, plating suggestions, wine pairing, and chef tips for making it ahead. Professional kitchen format.`;

    let recipe = '';
    try {
      const aiRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (aiRes.ok) {
        const data = await aiRes.json() as { response?: string };
        recipe = data.response || '';
      }
    } catch {
      recipe = `RECIPE: ${(dish_name || 'Seasonal Dish').toUpperCase()}\nServings: ${servings || 4}\n\nINGREDIENTS\n[Please complete with specific ingredients and quantities]\n\nMISE EN PLACE\n• Prepare all ingredients before starting\n• Bring proteins to room temperature\n• Preheat oven as needed\n• Gather all equipment\n\nINSTRUCTIONS\n1. Prepare ingredients as outlined\n2. Cook proteins to safe internal temperature\n3. Build sauce or accompaniments\n4. Rest and plate\n\nPLATING\n• Use warm plates for hot dishes\n• Build height and contrast on plate\n• Garnish with fresh herbs and finishing oil\n\nWINE PAIRING\n• Red: Full-bodied Bordeaux blend\n• White: Crisp Sauvignon Blanc\n\nCHEF TIPS\n• Can be prepped up to 24 hours in advance\n• Sauce can be made separately and stored\n• Rest proteins 5-10 minutes before service\n\n[AI service unavailable — complete recipe manually]`;
    }
    return Response.json({ recipe });
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}
