import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2';

function buildPrompt(body: Record<string, unknown>): string {
  const {
    rental_type, neighbourhood, bedrooms, bathrooms, sq_ft,
    furnished, amenities, monthly_rent, pets_allowed,
    utilities_included, platform,
  } = body;

  const amenityList   = Array.isArray(amenities) ? amenities.join(', ') : amenities ?? '';
  const utilityList   = Array.isArray(utilities_included) ? utilities_included.join(', ') : utilities_included ?? '';
  const bedroomsLabel = bedrooms === 0 || bedrooms === '0' ? 'Bachelor/Studio' : `${bedrooms} bedroom`;

  const platformGuidance: Record<string, string> = {
    rentals_ca: `Write in a professional property management tone. Include all key details: bedrooms, bathrooms, sq ft, furnished status, parking, pets, included utilities, and available amenities. Word count: 220-260 words.`,
    rentfaster:  `Tailor for Alberta renters. Mention nearby transit connections, proximity to major Calgary amenities (CTrain, parks, hospitals, schools if applicable), and highlight Alberta-specific tenant benefits. Word count: 200-240 words.`,
    airbnb:      `Write in a warm, welcoming, hospitality-forward tone. Highlight the neighbourhood vibe, furnished features, local attractions, walkability, and the guest experience. Ideal for short-term/furnished stays. Word count: 180-220 words.`,
    kijiji:      `Casual, clear, concise. Lead with the top 3 features that make this unit stand out. Avoid jargon. Easy to skim. Word count: 120-160 words.`,
    facebook:    `Friendly, conversational tone. Emojis are welcome. Keep it short (100-150 words). Lead with price and location. End with a clear call to action.`,
  };

  const guidance = platformGuidance[platform as string] ?? `Professional, balanced listing copy. Word count: 200-250 words.`;

  return `You are a Calgary, Alberta real estate listing copywriter.

Property details:
- Type: ${rental_type}
- Neighbourhood: ${neighbourhood}, Calgary, AB
- Size: ${bedroomsLabel}, ${bathrooms} bath, ${sq_ft} sq ft
- Furnished: ${furnished}
- Monthly Rent: $${monthly_rent}/mo
- Pets: ${pets_allowed}
- Utilities included: ${utilityList || 'none'}
- Amenities: ${amenityList || 'none'}

Platform: ${platform}
Instructions: ${guidance}

Write only the listing description. No titles, no headings, no bullet points unless the platform style calls for it. Output plain text only.`;
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json() as Record<string, unknown>;

  if (!body.rental_type || !body.neighbourhood) {
    return Response.json({ error: 'rental_type and neighbourhood are required' }, { status: 400 });
  }

  const prompt = buildPrompt(body);

  try {
    const ollamaRes = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: { temperature: 0.7, num_predict: 400 },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!ollamaRes.ok) throw new Error(`Ollama responded ${ollamaRes.status}`);
    const data = await ollamaRes.json() as { response?: string };
    const description = (data.response ?? '').trim();

    return Response.json({ description });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[generate-listing] Ollama error:', msg);

    // Graceful fallback
    const fallback = `Well-maintained ${body.rental_type} located in the heart of ${body.neighbourhood}, Calgary, AB. This ${body.bedrooms === 0 ? 'bachelor/studio' : `${body.bedrooms}-bedroom`} unit offers ${body.sq_ft} sq ft of comfortable living space at $${body.monthly_rent}/month. ${body.furnished !== 'unfurnished' ? `Comes ${body.furnished}.` : ''} ${Array.isArray(body.utilities_included) && body.utilities_included.length ? `Utilities included: ${(body.utilities_included as string[]).join(', ')}.` : ''} ${Array.isArray(body.amenities) && body.amenities.length ? `Building amenities: ${(body.amenities as string[]).join(', ')}.` : ''} Pets: ${body.pets_allowed}. Contact us today to schedule a viewing.`;

    return Response.json({ description: fallback, fallback: true });
  }
}
