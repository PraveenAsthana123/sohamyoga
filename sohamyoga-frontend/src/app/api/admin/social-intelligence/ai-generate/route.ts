import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';
import { ensureSocialIntelligenceSchema } from '@/lib/social-intelligence-schema';

import { requireAdmin } from '@/lib/admin-auth';
const PLATFORM_LIMITS: Record<string, Record<string, number>> = {
  youtube:   { video_post: 5000, short: 100, live: 500, community_post: 5000 },
  facebook:  { text_post: 63206, image_post: 63206, carousel: 63206, story: 15, reel: 2200 },
  instagram: { image_post: 2200, carousel: 2200, reel: 2200, story: 150 },
  x_twitter: { tweet: 280, thread: 280, poll: 280 },
  linkedin:  { text_post: 3000, article: 120000, video_post: 3000, document_post: 3000 },
  tiktok:    { video_post: 2200, live: 500 },
};

export async function POST(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSocialIntelligenceSchema();
  const { platform, content_type, topic, tone, niche, save } = await req.json();
  if (!platform || !content_type || !topic) {
    return Response.json({ error: 'platform, content_type, topic required' }, { status: 400 });
  }

  const maxChars = PLATFORM_LIMITS[platform]?.[content_type] ?? 2200;

  // Fetch best posting time and hashtag suggestions
  const configResult = await query(
    `SELECT best_posting_times FROM social_content_type_config WHERE platform = $1 AND content_type = $2 LIMIT 1`,
    [platform, content_type],
  );
  const bestTimes = configResult.rows[0]?.best_posting_times ?? [];

  const hashtagResult = await query(
    `SELECT hashtag FROM social_hashtag_performance WHERE platform = $1 AND ($2::text IS NULL OR niche = $2)
     ORDER BY trending_score DESC, avg_reach DESC LIMIT 5`,
    [platform, niche ?? null],
  );
  const suggestedHashtags = hashtagResult.rows.map(r => r.hashtag);

  let caption = '';
  let aiHashtags: string[] = suggestedHashtags;

  try {
    const platformGuide: Record<string, string> = {
      youtube: 'Write an engaging YouTube video description with a hook, key points, and call-to-action.',
      facebook: 'Write a Facebook post that encourages comments and shares. Keep it conversational.',
      instagram: 'Write an Instagram caption with a strong hook, story, and call-to-action. Include relevant emojis.',
      x_twitter: `Write a Twitter/X post. Maximum ${maxChars} characters. Be concise and punchy.`,
      linkedin: 'Write a professional LinkedIn post with insights, a personal story angle, and thought leadership.',
      tiktok: 'Write a TikTok video caption that is energetic, uses trending language, and includes a hook.',
    };

    const prompt = `${platformGuide[platform] ?? 'Write a social media post.'}

Topic: ${topic}
Tone: ${tone ?? 'inspirational'}
Niche: ${niche ?? 'wellness'}
Platform: ${platform}
Content type: ${content_type}
Maximum characters: ${maxChars}

Return a JSON object:
{
  "caption": "<the post caption/text>",
  "hashtags": [<array of 5-10 relevant hashtag strings without # prefix>],
  "hook": "<the first sentence/hook>",
  "cta": "<call to action>"
}
Only return the JSON object, no other text.`;

    const resp = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(45000),
    });

    if (resp.ok) {
      const data = await resp.json();
      const raw = (data.response ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      const parsed = JSON.parse(raw);
      caption = parsed.caption ?? '';
      if (parsed.hashtags?.length) aiHashtags = parsed.hashtags;
    }
  } catch {
    // Fallback caption
    caption = `${topic} — ${tone ?? 'Discover'} the benefits for your ${niche ?? 'wellness'} journey. Join us today!`;
  }

  // Trim to platform limit
  if (caption.length > maxChars) caption = caption.slice(0, maxChars - 3) + '...';

  const result = {
    platform,
    content_type,
    caption,
    hashtags: aiHashtags,
    suggested_time: bestTimes[0] ?? 'Tuesday 10am',
    char_count: caption.length,
    max_chars: maxChars,
    ai_model: 'llama3.2',
  };

  // Optionally save as variant
  if (save) {
    await query(
      `INSERT INTO social_content_variant (platform, content_type, caption, hashtags, char_count, word_count, ai_generated, ai_model, ai_prompt, status)
       VALUES ($1, $2, $3, $4, $5, $6, true, 'llama3.2', $7, 'draft') RETURNING id`,
      [platform, content_type, caption, aiHashtags, caption.length, caption.split(/\s+/).filter(Boolean).length, `topic:${topic} tone:${tone} niche:${niche}`],
    );
  }

  return Response.json(result);
}
