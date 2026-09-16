import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { ensureSocialIntelligenceSchema } from '@/lib/social-intelligence-schema';

const NICHES = ['yoga', 'fitness', 'wellness', 'marketing', 'ecommerce'];

export async function GET(req: NextRequest) {
  await ensureSocialIntelligenceSchema();
  const niche = req.nextUrl.searchParams.get('niche') ?? 'yoga';
  const platform = req.nextUrl.searchParams.get('platform') ?? 'instagram';

  // Get top hashtags for the niche/platform
  const hashtagResult = await query(
    `SELECT hashtag FROM social_hashtag_performance
     WHERE platform = $1 AND niche = $2
     ORDER BY trending_score DESC LIMIT 10`,
    [platform, niche],
  ).catch(() => ({ rows: [] }));
  const topHashtags = (hashtagResult.rows as Array<{ hashtag: string }>).map(r => r.hashtag);

  // Get best posting time for platform
  const configResult = await query(
    `SELECT best_posting_times, content_type FROM social_content_type_config
     WHERE platform = $1 ORDER BY avg_engagement_rate DESC LIMIT 3`,
    [platform],
  ).catch(() => ({ rows: [] }));

  // Generate 5 ideas via Ollama
  let ideas: Array<{
    platform: string; content_type: string; hook: string;
    caption_idea: string; suggested_hashtags: string[]; best_time: string;
  }> = [];

  try {
    const bestTypes = (configResult.rows as Array<{ content_type: string }>).map(r => r.content_type).join(', ');
    const prompt = `Generate 5 social media content ideas for a ${niche} brand on ${platform}.
Best content types for this platform: ${bestTypes}.
Available trending hashtags: ${topHashtags.slice(0, 8).join(', ')}.

Return a JSON array of 5 ideas, each with:
{
  "content_type": "<one of: ${bestTypes}>",
  "hook": "<attention-grabbing first line, max 15 words>",
  "caption_idea": "<2-3 sentence content idea description>",
  "suggested_hashtags": [<3-5 hashtags from the available list>],
  "best_time": "<day and time recommendation>"
}

Only return the JSON array, no other text.`;

    const resp = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(40000),
    });

    if (resp.ok) {
      const data = await resp.json();
      const raw = (data.response ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      const parsed = JSON.parse(raw);
      ideas = parsed.map((idea: {
        content_type: string; hook: string; caption_idea: string;
        suggested_hashtags: string[]; best_time: string;
      }) => ({ platform, ...idea }));
    }
  } catch {
    // Fallback ideas
    ideas = [
      { platform, content_type: 'reel', hook: `5 ${niche} tips you wish you knew sooner`, caption_idea: `Share practical tips that beginners often miss. Show real examples.`, suggested_hashtags: topHashtags.slice(0, 3), best_time: 'Tuesday 9am' },
      { platform, content_type: 'image_post', hook: `Behind the scenes of our ${niche} journey`, caption_idea: `Show the authentic, unfiltered side of your practice or business.`, suggested_hashtags: topHashtags.slice(1, 4), best_time: 'Wednesday 11am' },
      { platform, content_type: 'carousel', hook: `The ${niche} mistake 90% of people make`, caption_idea: `Educational carousel highlighting common misconceptions and correct approach.`, suggested_hashtags: topHashtags.slice(2, 5), best_time: 'Thursday 10am' },
      { platform, content_type: 'story', hook: `Poll: What's your biggest ${niche} challenge?`, caption_idea: `Engage your audience with a poll to understand their pain points.`, suggested_hashtags: topHashtags.slice(0, 2), best_time: 'Friday 8am' },
      { platform, content_type: 'reel', hook: `Day in the life of a ${niche} practitioner`, caption_idea: `Authentic day-in-the-life content builds trust and community.`, suggested_hashtags: topHashtags.slice(3, 6), best_time: 'Saturday 11am' },
    ];
  }

  return NextResponse.json({ ideas, niche, platform });
}
