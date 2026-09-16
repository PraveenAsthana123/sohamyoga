export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { niche, audience, budget_range, platform } = await req.json();

  const prompt = `You are an influencer marketing specialist. Suggest 5 ideal influencer profiles for a brand in the "${niche}" niche targeting "${audience}" on ${platform || 'social media'} with budget "${budget_range}".
Return JSON:
{
  "influencers": [
    {
      "handle": "@suggested_handle",
      "platform": "instagram|tiktok|youtube|etc",
      "estimated_followers": 50000,
      "estimated_engagement_rate": 4.5,
      "niche_alignment": "why this influencer fits",
      "content_style": "description of their content style",
      "match_score": 88,
      "outreach_tip": "personalized outreach tip"
    }
  ]
}`;

  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json() as { response?: string };
    let parsed: { influencers?: unknown[] } = {};
    try {
      const match = (data.response || '').match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    } catch { /* fallback */ }
    return Response.json({ influencers: parsed.influencers || getFallbackInfluencers(niche, platform), ai_generated: !!parsed.influencers });
  } catch {
    return Response.json({ influencers: getFallbackInfluencers(niche, platform), ai_generated: false, fallback: true });
  }
}

function getFallbackInfluencers(niche: string, platform: string) {
  return [
    { handle: `@${niche.replace(/\s+/g, '_')}_pro1`, platform: platform || 'instagram', estimated_followers: 125000, estimated_engagement_rate: 4.8, niche_alignment: `Strong ${niche} content creator`, content_style: 'Educational tutorials and lifestyle', match_score: 92, outreach_tip: 'Mention their recent post about wellness transformation' },
    { handle: `@wellness_creator2`, platform: platform || 'tiktok', estimated_followers: 89000, estimated_engagement_rate: 6.2, niche_alignment: `Active in ${niche} community`, content_style: 'Short-form entertaining content', match_score: 85, outreach_tip: 'Offer free product trial before formal partnership' },
    { handle: `@mindful_moments3`, platform: platform || 'youtube', estimated_followers: 215000, estimated_engagement_rate: 3.1, niche_alignment: `${niche} authority`, content_style: 'Long-form documentary style', match_score: 79, outreach_tip: 'Propose a dedicated review video with affiliate link' },
    { handle: `@health_journey4`, platform: platform || 'instagram', estimated_followers: 67000, estimated_engagement_rate: 7.5, niche_alignment: `Micro-influencer ${niche} expert`, content_style: 'Personal journey and authentic sharing', match_score: 88, outreach_tip: 'Great for authentic testimonial content' },
    { handle: `@fit_lifestyle5`, platform: platform || 'tiktok', estimated_followers: 445000, estimated_engagement_rate: 5.2, niche_alignment: `Trending ${niche} creator`, content_style: 'Viral challenge and trend content', match_score: 76, outreach_tip: 'Suggest a branded challenge partnership' },
  ];
}
