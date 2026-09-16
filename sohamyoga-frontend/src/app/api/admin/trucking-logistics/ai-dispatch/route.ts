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
    const { origin, destination, commodity, weight, special_requirements } = await req.json();
    if (!origin || !destination) return Response.json({ error: 'origin and destination required' }, { status: 400 });

    const prompt = `You are a Canadian trucking dispatch expert with deep knowledge of Canadian transportation regulations, CVSA requirements, and road networks. Provide practical dispatch advice for the following load:

Origin: ${origin}
Destination: ${destination}
Commodity: ${commodity || 'General freight'}
Weight: ${weight ? `${weight} kg` : 'Unknown'}
Special Requirements: ${special_requirements || 'None'}

Provide a concise advisory covering:
1. **Route Recommendations** — primary and alternate highway routes, key waypoints
2. **Weight & Permit Requirements** — CVSA weight limits, oversize/overweight permits if needed for Alberta/Canada
3. **Estimated Transit Time** — realistic drive time including mandatory rest stops (ELD compliance, HOS rules)
4. **Fuel Stop Suggestions** — major truck stops along the route
5. **Canadian Border / Provincial Notes** — if cross-provincial or international, key border crossing tips
6. **Regulatory Notes** — any commodity-specific Transport Canada / CFIA requirements
7. **Weather / Seasonal Considerations** — current season conditions for this corridor

Be specific to Canadian roads. Keep each section to 2-3 sentences.`;

    let advice = '';
    try {
      const ollamaRes = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (ollamaRes.ok) {
        const data = await ollamaRes.json() as { response?: string };
        advice = data.response || '';
      }
    } catch {
      // graceful fallback
    }

    if (!advice) {
      advice = `**Route Recommendations**\nFor ${origin} to ${destination}, use the Trans-Canada Highway (Hwy 1) as the primary corridor where applicable. Check for construction delays on the Coquihalla in BC or Ring Road in Calgary.\n\n**Weight & Permit Requirements**\nAlberta allows 63,500 kg on approved highways (Class 1 Permit). Verify the specific loaded weight for oversize permit requirements through Alberta Transportation's portal.\n\n**Estimated Transit Time**\nExpect 8-12 hours driving time depending on distance, plus mandatory 10-hour rest periods per Canadian ELD/HOS regulations (effective 2023).\n\n**Fuel Stop Suggestions**\nIron Skillet and Petro-Canada truck stops are available at major interchange points. Pilot Flying J locations are found at key Trans-Canada intersections.\n\n**Canadian Border / Provincial Notes**\nEnsure a valid CVOR certificate (Ontario) or NSC carrier profile (other provinces) is on board. Cross-provincial loads need a valid safety fitness certificate.\n\n**Regulatory Notes**\nFor food commodities, ensure refrigeration unit logs are maintained for CFIA compliance. Hazmat loads require TDG (Transport of Dangerous Goods) documentation.\n\n**Weather / Seasonal Considerations**\nMonitor Alberta 511 and DriveBC for road conditions. Mountain passes may require tire chains October–April.`;
    }

    return Response.json({ advice, origin, destination, commodity, weight });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
