import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { ollama } from '@/cron/OllamaClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return Response.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const { niche, platform, min_followers, max_rate_cad } = body as Record<string, unknown>;

    if (!niche || !platform) {
      return Response.json({ error: 'niche and platform are required.' }, { status: 400 });
    }

    const prompt = `Suggest 5 types of influencers (not real names, use archetypal personas) for a ${String(niche)} brand on ${String(platform)} with ${min_followers ? String(min_followers) : '10,000'}+ followers and maximum rate of $${max_rate_cad ? String(max_rate_cad) : '1,000'} CAD per post.

For each influencer type, provide:
- persona_name: a descriptive archetype name (e.g. "The Wellness Mom", "The Corporate Burnout Survivor")
- handle_style: typical username style for this persona
- content_type: what they typically post (2-3 types)
- why_good_fit: why this persona works for the ${String(niche)} brand (1-2 sentences)
- estimated_engagement_rate: number between 0.01 and 0.12 (e.g. 0.045)
- estimated_followers: integer (e.g. 45000)
- platform: ${String(platform)}
- content_pillars: array of 3 main content themes

Output ONLY a valid JSON array of 5 objects. No explanation, no markdown fences.`;

    const raw = await ollama.generate(prompt, {
      tier: 'strong',
      maxTokens: 1500,
      timeoutMs: 60_000,
    });

    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return Response.json({ error: 'Ollama did not return a parseable JSON array.' }, { status: 502 });
    }

    const suggestions = JSON.parse(jsonMatch[0]) as unknown[];

    return Response.json({ ok: true, suggestions, count: suggestions.length });
  } catch (err) {
    console.error('[influencers/discover] POST error:', err);
    const message = err instanceof Error ? err.message : 'AI discovery failed.';
    return Response.json({ error: message }, { status: 502 });
  }
}
