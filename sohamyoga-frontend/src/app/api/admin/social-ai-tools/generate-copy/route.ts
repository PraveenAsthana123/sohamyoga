export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { platform, tone, topic, target_audience } = await req.json();

  const platformGuide: Record<string, string> = {
    twitter: '280 characters max, use 2-3 hashtags, punchy opening',
    instagram: '125-200 words, 5-10 hashtags, emojis, line breaks',
    linkedin: '150-300 words, professional, no excessive hashtags',
    tiktok: 'hook in first 3 words, 150 chars, trending sound mention optional',
    facebook: '40-80 words for best engagement, conversational',
  };
  const guide = platformGuide[platform] || '100-150 words';
  const prompt = `You are a social media copywriter. Write a ${tone} ${platform} post about "${topic}" targeting "${target_audience}".
Guidelines: ${guide}
Return a JSON object with:
- "copy": the post text
- "hashtags": array of 5 relevant hashtags
- "hook": the opening hook (first sentence)
- "cta": the call to action
Keep it authentic and engaging.`;

  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json() as { response?: string };
    let parsed: Record<string, unknown> = {};
    try {
      const match = (data.response || '').match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    } catch { /* use fallback */ }
    return Response.json({
      copy: parsed.copy || `Discover the power of ${topic}! Perfect for ${target_audience}. Your ${platform} community is waiting. #wellness #yoga`,
      hashtags: (parsed.hashtags as string[]) || ['#wellness', '#yoga', '#mindfulness', '#health', '#fitness'],
      hook: parsed.hook || `Transform your ${topic} journey today!`,
      cta: parsed.cta || 'Learn more — link in bio!',
      ai_generated: true,
    });
  } catch {
    return Response.json({
      copy: `✨ ${topic} — your path to ${tone} living starts here. Perfect for ${target_audience}. Join thousands already transforming their lives.`,
      hashtags: ['#wellness', '#yoga', '#mindfulness', '#health', '#community'],
      hook: `${topic} changed everything for us.`,
      cta: 'Start your journey today!',
      ai_generated: false,
      fallback: true,
    });
  }
}
