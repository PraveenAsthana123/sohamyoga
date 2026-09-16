import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PLATFORM_PROMPTS: Record<string, { system: string; instruction: string }> = {
  kijiji: {
    system: 'You are a Canadian classifieds copywriter specializing in Kijiji ads. Write friendly, engaging ads with a warm Canadian tone.',
    instruction: 'Write a 250-350 word Kijiji ad. Use bullet points for key features. Be friendly and approachable. Include a clear call to action. Mention Calgary. Do not use HTML tags.',
  },
  craigslist: {
    system: 'You are a concise classifieds writer for Craigslist. Keep ads short, factual, and plain-text only.',
    instruction: 'Write a 150-200 word Craigslist ad. Be concise and factual. Plain text only, no HTML. No marketing fluff. State facts clearly. Include price and location.',
  },
  facebook_marketplace: {
    system: 'You are a social media copywriter for Facebook Marketplace. Write conversational, community-friendly ads.',
    instruction: 'Write a 100-150 word Facebook Marketplace listing. Use conversational tone. Include 2-3 relevant emojis naturally. Community-friendly language. End with a friendly call to action.',
  },
  autotrader: {
    system: 'You are an automotive classifieds specialist. Write detailed, technical vehicle descriptions.',
    instruction: 'Write a detailed vehicle listing focusing on: technical specifications, vehicle condition, maintenance history mentions, any recent work done, mileage context. 200-300 words. Factual and professional.',
  },
  realtor_ca: {
    system: 'You are a professional real estate copywriter in Calgary. Write MLS-style property descriptions.',
    instruction: 'Write a 200-280 word professional real estate listing. Use property-specific language. Highlight neighbourhood amenities, transit, schools nearby if relevant. Professional tone. Include property highlights and lifestyle appeal.',
  },
  zumper: {
    system: 'You are a rental property copywriter. Write appealing rental listings for Calgary renters.',
    instruction: 'Write a 180-250 word rental listing. Highlight amenities, pet policy, utilities included, proximity to transit and downtown. Friendly but professional tone.',
  },
  usedcalgary: {
    system: 'You are a local Calgary classifieds writer for UsedCalgary.com.',
    instruction: 'Write a 200-280 word ad for a Calgary local audience. Friendly tone, mention the Calgary neighbourhood. Describe condition clearly. Include price justification.',
  },
  calgary_herald: {
    system: 'You are a newspaper classifieds copywriter for the Calgary Herald.',
    instruction: 'Write a 150-250 word newspaper-style classified ad. Clear, professional language. Include essential details: price, condition, contact info guidance. Traditional classifieds style.',
  },
  oodle: {
    system: 'You are a classifieds aggregator copywriter.',
    instruction: 'Write a 180-250 word general classifieds ad suitable for an aggregator site. Include keywords for searchability. Clear description of item/service. Calgary context included.',
  },
  indeed: {
    system: 'You are a job posting specialist for Calgary employers.',
    instruction: 'Write a 200-300 word job posting. Include: role summary, key responsibilities (3-5 bullets), qualifications needed, what makes this opportunity appealing, company culture hint. Professional tone.',
  },
};

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid body.' }, { status: 400 });
  const { title, category, key_features, price, neighbourhood, platform } = body as Record<string, unknown>;
  if (!title || !platform) return Response.json({ error: 'title and platform required.' }, { status: 400 });

  const platformConfig = PLATFORM_PROMPTS[platform as string] ?? {
    system: 'You are a professional classifieds copywriter.',
    instruction: 'Write a 200-300 word general classified ad. Clear, engaging, and informative. Include price and location context.',
  };

  const contextBlock = [
    `Listing Title: ${title}`,
    category ? `Category: ${category}` : '',
    key_features ? `Key Features: ${key_features}` : '',
    price ? `Price: $${price}` : '',
    neighbourhood ? `Neighbourhood: ${neighbourhood}, Calgary, AB` : 'Location: Calgary, AB',
  ].filter(Boolean).join('\n');

  const prompt = `${platformConfig.system}\n\n${platformConfig.instruction}\n\nListing Details:\n${contextBlock}\n\nWrite only the ad copy, no preamble or meta-commentary.`;

  try {
    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });

    if (!ollamaRes.ok) throw new Error(`Ollama ${ollamaRes.status}`);
    const data = await ollamaRes.json() as { response?: string };
    const copy = (data.response ?? '').trim();
    if (!copy) throw new Error('Empty response from Ollama');
    return Response.json({ copy, platform, generated_by: 'ollama/llama3.2' });
  } catch (err) {
    console.warn('Ollama unavailable, using fallback copy:', err);
    const fallback = generateFallbackCopy(platform as string, title as string, price as string | undefined, neighbourhood as string | undefined, key_features as string | undefined);
    return Response.json({ copy: fallback, platform, generated_by: 'fallback' });
  }
}

function generateFallbackCopy(platform: string, title: string, price?: string, neighbourhood?: string, features?: string): string {
  const loc = neighbourhood ? `${neighbourhood}, Calgary` : 'Calgary, AB';
  const priceStr = price ? `$${price}` : 'Contact for pricing';
  const featList = features ? features.split('\n').filter(Boolean).map(f => `• ${f.trim()}`).join('\n') : '';

  const templates: Record<string, string> = {
    kijiji: `${title} — ${loc}\n\nLooking for a great deal in Calgary? Look no further!\n\nPrice: ${priceStr}\nLocation: ${loc}\n\n${featList ? `Key Features:\n${featList}\n\n` : ''}This is a fantastic opportunity for Calgary buyers. Item is well-maintained and ready for pickup. All reasonable offers considered.\n\nPlease message or call for more information. Cash or e-Transfer accepted. No holds without a deposit. Thanks for looking, eh!`,
    craigslist: `${title}\n\nPrice: ${priceStr}\nLocation: ${loc}\n\n${featList || 'Good condition. See photos.'}\n\nCash only. Serious inquiries only. No scams or low-balls. Available for local pickup in ${loc}.`,
    facebook_marketplace: `${title} for sale in ${loc}! 🏷️\n\nAsking ${priceStr} — ${featList ? 'great condition!\n\n' + featList : 'great condition!'}\n\nPickup in ${loc}. Message me for more info or to arrange viewing! 😊`,
    default: `${title}\n\nLocation: ${loc}\nPrice: ${priceStr}\n\n${featList || 'Please contact for full details.'}\n\nContact us today for more information about this listing in ${loc}.`,
  };

  return (templates[platform] ?? templates.default);
}
