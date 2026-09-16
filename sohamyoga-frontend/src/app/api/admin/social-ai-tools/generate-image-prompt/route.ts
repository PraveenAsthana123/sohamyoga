export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { topic, style, platform } = await req.json();

  const prompt = `You are an AI image prompt engineer for Midjourney and DALL-E. Create 3 detailed image prompts for "${topic}" in "${style}" style for use on ${platform || 'social media'}.
Each prompt should be highly descriptive with lighting, mood, composition, and style details.
Return JSON: { "prompts": [ { "prompt": "...", "negative_prompt": "...", "style_tags": [] }, ... ] }
Make each prompt unique and optimized for social media visual impact.`;

  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json() as { response?: string };
    let parsed: { prompts?: unknown[] } = {};
    try {
      const match = (data.response || '').match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    } catch { /* fallback */ }
    const prompts = parsed.prompts || [
      { prompt: `${topic}, ${style} photography, golden hour lighting, soft bokeh background, vibrant colors, 8k ultra-detailed, professional shot, wellness aesthetic`, negative_prompt: 'blurry, low quality, dark', style_tags: ['golden-hour', 'wellness', 'professional'] },
      { prompt: `${topic}, minimalist ${style} composition, white background, clean lines, Instagram-worthy, studio lighting, lifestyle photography`, negative_prompt: 'cluttered, dark, noisy', style_tags: ['minimalist', 'studio', 'lifestyle'] },
      { prompt: `${topic}, dramatic ${style} mood, cinematic composition, warm tones, inspiring atmosphere, high contrast, editorial style`, negative_prompt: 'amateur, flat lighting, dull', style_tags: ['cinematic', 'editorial', 'dramatic'] },
    ];
    return Response.json({ prompts, ai_generated: true });
  } catch {
    return Response.json({
      prompts: [
        { prompt: `${topic}, professional photography, bright natural lighting, wellness aesthetic, high resolution`, negative_prompt: 'blurry, dark', style_tags: ['natural', 'wellness'] },
        { prompt: `${topic}, minimalist composition, clean background, Instagram style, vibrant colors`, negative_prompt: 'cluttered', style_tags: ['minimal', 'social'] },
        { prompt: `${topic}, editorial photography, cinematic mood, warm tones, inspiring`, negative_prompt: 'amateur', style_tags: ['editorial', 'cinematic'] },
      ],
      ai_generated: false,
      fallback: true,
    });
  }
}
