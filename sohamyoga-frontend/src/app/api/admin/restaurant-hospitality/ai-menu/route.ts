import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const { cuisine_type, season, dietary_trend, price_point } = await req.json();
    if (!cuisine_type) return Response.json({ error: 'cuisine_type required' }, { status: 400 });

    const currentSeason = season || (() => {
      const m = new Date().getMonth();
      if (m >= 2 && m <= 4) return 'Spring'; if (m >= 5 && m <= 7) return 'Summer';
      if (m >= 8 && m <= 10) return 'Fall'; return 'Winter';
    })();

    const prompt = `You are a creative Canadian restaurant chef and menu consultant. Design a seasonal menu update for a ${cuisine_type} restaurant in Calgary, Alberta.

Season: ${currentSeason}
Dietary Trends to Incorporate: ${dietary_trend || 'vegan-friendly, gluten-free options, locally-sourced'}
Target Price Point: ${price_point || 'mid-range ($25-45 per main)'}

Generate a seasonal menu proposal including:

**FEATURED DISHES (3 mains)**
For each: dish name, brief description, key ingredients, suggested price, estimated food cost %, allergens to note

**DAILY SPECIALS (2 dishes)**
Seasonal ingredients only, lower food cost

**SEASONAL COCKTAILS (2 drinks)**
Using seasonal Canadian ingredients where possible, with suggested price

**CHEF'S SEASONAL NOTES**
Key Alberta/Canadian seasonal ingredients to feature this ${currentSeason}, local supplier suggestions, and one dish to consider retiring

Keep suggestions practical for a Calgary market restaurant. Include food cost estimates.`;

    let menu = '';
    try {
      const r = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (r.ok) { const d = await r.json() as { response?: string }; menu = d.response || ''; }
    } catch { /* graceful fallback */ }

    if (!menu) {
      menu = `**FEATURED DISHES**

1. **${currentSeason} Harvest Grain Bowl** — Farro, roasted root vegetables, kale, pumpkin seeds, tahini dressing — $26 | Food cost: ~28% | Allergens: sesame | GF, Vegan

2. **Alberta Bison Short Rib** — 12-hour braised bison short rib, celery root purée, ${currentSeason === 'Fall' || currentSeason === 'Winter' ? 'pickled cranberry, roasted beet' : 'spring pea, asparagus'} — $42 | Food cost: ~31% | Allergens: dairy, gluten

3. **Wild Pacific Halibut** — Pan-seared, ${currentSeason === 'Summer' ? 'corn succotash, charred lemon butter' : 'butternut squash, sage brown butter'}, capers — $38 | Food cost: ~33% | Allergens: dairy, shellfish | GF

**DAILY SPECIALS**

1. **${currentSeason} Soup du Jour** — Rotating daily using market-fresh vegetables — $12 | Food cost: ~20%

2. **Weekend Brunch Special** — Two eggs any style, seasonal hash, toast — $18 | Food cost: ~25%

**SEASONAL COCKTAILS**

1. **Prairie Harvest Sour** — Rye whisky, lemon, honey syrup, egg white — $14

2. **Spruce Tip Gin & Tonic** — Local gin, spruce tip syrup, premium tonic, rosemary — $13

**CHEF'S SEASONAL NOTES**

Key ${currentSeason} Alberta ingredients: saskatoon berries, wild mushrooms, Alberta lamb, greenhouse tomatoes from Lacombe.
Local suppliers: Troubled Monk (craft spirits), Fresh Fields Produce (organic produce), Turner Valley Garlic (local garlic).
Consider retiring: any off-season dish with imported produce driving food cost above 38%.`;
    }

    return Response.json({ menu, cuisine_type, season: currentSeason, dietary_trend, price_point });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
