import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

async function callOllama(prompt: string): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const data = await res.json() as { response?: string };
  return (data.response || '').trim();
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request body.' }, { status: 400 });

  const {
    property_type, address, neighbourhood, bedrooms, bathrooms,
    sq_ft, year_built, features, price, listing_type,
  } = body as Record<string, unknown>;

  if (!property_type || !address) {
    return Response.json({ error: 'property_type and address are required.' }, { status: 400 });
  }

  const featureList = Array.isArray(features) && features.length > 0
    ? (features as string[]).join(', ')
    : 'modern finishes';

  const listingTypeLabel = listing_type === 'lease' ? 'for lease' : 'for sale';
  const priceStr = price ? `$${Number(price).toLocaleString('en-CA')}` : 'contact for pricing';
  const neighbourhoodStr = neighbourhood || 'Calgary';
  const bedsStr = bedrooms ? `${bedrooms} bedroom` : '';
  const bathsStr = bathrooms ? `${bathrooms} bathroom` : '';
  const sqFtStr = sq_ft ? `${sq_ft} sq ft` : '';
  const yearStr = year_built ? `built in ${year_built}` : '';

  const prompt = `You are a professional Canadian real estate listing copywriter specializing in Calgary, Alberta properties.

Write a compelling MLS-style property listing description for the following property. The description must be exactly 200-300 words, professional, factual, and persuasive.

Property Details:
- Type: ${property_type} ${listingTypeLabel}
- Address: ${address}
- Neighbourhood: ${neighbourhoodStr}, Calgary, AB
- ${bedsStr}${bedsStr && bathsStr ? ', ' : ''}${bathsStr}${sqFtStr ? ', ' + sqFtStr : ''}${yearStr ? ', ' + yearStr : ''}
- Price: ${priceStr}
- Key Features: ${featureList}

Structure the description as follows:
1. One compelling headline sentence that highlights the property's best feature and neighbourhood
2. Two paragraphs describing the property highlights with specific details from the features list
3. One paragraph about the ${neighbourhoodStr} neighbourhood, its lifestyle benefits, proximity to amenities, schools, and transit in Calgary
4. One closing call-to-action sentence encouraging showings

Do not use hyperbole. Write in Canadian English. Do not include the address in the description. Return only the listing description text, no headers or labels.`;

  let description: string;

  try {
    description = await callOllama(prompt);
    if (!description || description.length < 50) throw new Error('Empty response from Ollama');
  } catch (err) {
    console.warn('Ollama generate-listing fallback:', err instanceof Error ? err.message : err);

    // Graceful fallback
    const propLabel = (property_type as string).replace(/_/g, ' ');
    description = `Welcome to this exceptional ${propLabel} ${listingTypeLabel} in the sought-after community of ${neighbourhoodStr}, Calgary. ` +
      `${bedsStr && bathsStr ? `Featuring ${bedsStr}s and ${bathsStr}s${sqFtStr ? ` across ${sqFtStr}` : ''}, this` : 'This'} property offers an ideal blend of comfort and style. ` +
      `${featureList ? `Highlights include ${featureList}, ` : ''}making this home truly move-in ready. ` +
      `${neighbourhoodStr} is one of Calgary's most desirable communities, offering excellent schools, convenient transit connections, shopping, dining, and recreational amenities within easy reach. ` +
      `Whether you're a first-time buyer, growing family, or savvy investor, this property represents outstanding value at ${priceStr}. ` +
      `Contact us today to schedule your private showing — properties like this don't last long in Calgary's dynamic market.`;
  }

  return Response.json({ description });
}
