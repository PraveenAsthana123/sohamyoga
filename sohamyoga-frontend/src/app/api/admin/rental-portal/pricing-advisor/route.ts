import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OLLAMA_BASE  = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL    ?? 'llama3.2';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json() as Record<string, unknown>;
  const { neighbourhood, bedrooms, rental_type, sq_ft, furnished, amenities } = body;

  if (!neighbourhood || !rental_type) {
    return Response.json({ error: 'neighbourhood and rental_type are required' }, { status: 400 });
  }

  const amenityList = Array.isArray(amenities) ? amenities.join(', ') : amenities ?? 'none';
  const bedroomLabel = bedrooms === 0 || bedrooms === '0' ? 'Bachelor/Studio' : `${bedrooms}-bedroom`;

  const prompt = `You are an expert Calgary, Alberta rental market analyst with deep knowledge of 2024-2025 rental prices across all neighbourhoods.

Provide a rental pricing analysis for:
- Property type: ${rental_type}
- Size: ${bedroomLabel}, ${sq_ft ? `${sq_ft} sq ft` : 'size not specified'}
- Furnished: ${furnished ?? 'unfurnished'}
- Neighbourhood: ${neighbourhood}, Calgary, AB
- Amenities: ${amenityList}

Provide your response in this exact structure:

**Suggested Rent Range:** $X,XXX – $X,XXX/month

**Market Position:**
2-3 sentences on where this property fits in the Calgary rental market for this neighbourhood and type.

**Comparable Features That Affect Price:**
- List 3-4 features that push rent higher or lower in this specific case

**Seasonal Advice:**
1-2 sentences on the best months to list in Calgary and any seasonal demand patterns.

**Vacancy Reduction Tips:**
List 3 specific, actionable tips to minimize vacancy for this type of property in Calgary.

**Key Calgary Market Insight:**
One important current trend in the Calgary rental market that this landlord should know.

Keep the response practical and Calgary-specific. Do not invent precise statistics without basis.`;

  try {
    const ollamaRes = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: { temperature: 0.5, num_predict: 600 },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!ollamaRes.ok) throw new Error(`Ollama responded ${ollamaRes.status}`);
    const data = await ollamaRes.json() as { response?: string };
    const advice = (data.response ?? '').trim();

    return Response.json({ advice });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[pricing-advisor] Ollama error:', msg);

    const fallback = `**Suggested Rent Range:** Based on current Calgary market conditions for a ${bedroomLabel} ${rental_type} in ${neighbourhood}, consult recent RentFaster.ca or Rentals.ca listings for real-time comparable pricing.

**Market Position:**
Calgary's rental market has seen strong demand due to interprovincial migration. ${neighbourhood} is a sought-after area. Price competitively against similar units within 2km.

**Comparable Features That Affect Price:**
- In-suite laundry adds $50–$100/month premium
- Underground parking adds $100–$150/month
- Fully furnished commands 20–35% premium over unfurnished
- Pet-friendly listings have less competition — consider a pet deposit instead of blanket bans

**Seasonal Advice:**
List in April–June and August–September for peak demand. December–January sees slower activity.

**Vacancy Reduction Tips:**
1. Respond to inquiries within 2 hours — Calgary renters move fast
2. List on RentFaster.ca first — it dominates Alberta search traffic
3. Professional photos reduce time-on-market by an average of 40%

**Key Calgary Market Insight:**
Calgary continues to attract renters from BC and Ontario due to affordability compared to Vancouver and Toronto, keeping vacancy rates low in inner-city and southwest neighbourhoods.`;

    return Response.json({ advice: fallback, fallback: true });
  }
}
