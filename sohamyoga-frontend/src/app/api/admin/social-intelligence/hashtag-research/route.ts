import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';
import { ensureSocialIntelligenceSchema } from '@/lib/social-intelligence-schema';

import { requireAdmin } from '@/lib/admin-auth';
export async function POST(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSocialIntelligenceSchema();
  const { hashtag, platform, niche } = await req.json();
  if (!hashtag || !platform) {
    return Response.json({ error: 'hashtag and platform required' }, { status: 400 });
  }

  // Call Ollama to estimate hashtag metrics
  let ollamaData: {
    avg_reach: number; avg_engagement: number; trending_score: number;
    competition_level: string; similar_hashtags: string[];
  } = {
    avg_reach: 5000, avg_engagement: 2.5, trending_score: 50,
    competition_level: 'medium', similar_hashtags: [],
  };

  try {
    const prompt = `Analyze the social media hashtag "#${hashtag}" for the ${platform} platform${niche ? ` in the ${niche} niche` : ''}.
Return a JSON object with these fields:
{
  "avg_reach": <estimated average reach per post using this hashtag, number>,
  "avg_engagement": <estimated engagement rate percentage, number 0-100>,
  "trending_score": <current trending score 0-100>,
  "competition_level": <"low"|"medium"|"high">,
  "similar_hashtags": [<list of 5 similar relevant hashtags without # prefix>]
}
Only return the JSON object, no other text.`;

    const resp = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });

    if (resp.ok) {
      const data = await resp.json();
      const raw = (data.response ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      const parsed = JSON.parse(raw);
      ollamaData = { ...ollamaData, ...parsed };
    }
  } catch {
    // Ollama unavailable — use defaults
  }

  // Upsert primary hashtag
  await query(
    `INSERT INTO social_hashtag_performance (platform, hashtag, niche, avg_reach, avg_engagement, trending_score, competition_level, recommended_for, last_analyzed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (platform, hashtag) DO UPDATE SET
       avg_reach = EXCLUDED.avg_reach,
       avg_engagement = EXCLUDED.avg_engagement,
       trending_score = EXCLUDED.trending_score,
       competition_level = EXCLUDED.competition_level,
       last_analyzed_at = NOW()`,
    [platform, hashtag, niche ?? null, ollamaData.avg_reach, ollamaData.avg_engagement, ollamaData.trending_score, ollamaData.competition_level, []],
  );

  // Upsert similar hashtags
  for (const similar of (ollamaData.similar_hashtags ?? []).slice(0, 5)) {
    await query(
      `INSERT INTO social_hashtag_performance (platform, hashtag, niche, avg_reach, avg_engagement, trending_score, competition_level, last_analyzed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (platform, hashtag) DO NOTHING`,
      [platform, similar, niche ?? null, Math.round(ollamaData.avg_reach * 0.7), ollamaData.avg_engagement * 0.8, ollamaData.trending_score * 0.9, 'medium'],
    ).catch(() => {});
  }

  return Response.json({
    hashtag,
    platform,
    ...ollamaData,
  });
}
