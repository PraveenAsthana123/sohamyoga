export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { product, target_audience, goal } = await req.json();

  const prompt = `You are a TikTok ad specialist. Create a complete TikTok ad for "${product}" targeting "${target_audience}" with goal "${goal}".
Return JSON:
{
  "hook": "3-second opening hook (must grab attention immediately)",
  "script": "Full 15-second script with timestamps [0s], [5s], [10s], [15s]",
  "cta": "Clear call-to-action",
  "trending_sounds": ["sound1", "sound2"],
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
  "visual_tips": ["visual tip 1", "visual tip 2", "visual tip 3"]
}`;

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
    } catch { /* fallback */ }
    return Response.json({
      hook: parsed.hook || `Wait — ${product} actually WORKS and here's proof 👀`,
      script: parsed.script || `[0s] POV: You discovered ${product}\n[5s] Here's what happened after 30 days\n[10s] The results surprised everyone\n[15s] Try it yourself — link in bio!`,
      cta: parsed.cta || 'Tap the link in bio to start your free trial today!',
      trending_sounds: (parsed.trending_sounds as string[]) || ['Aesthetic lofi beats', 'Trending viral audio'],
      hashtags: (parsed.hashtags as string[]) || ['#fyp', '#wellness', '#yoga', '#transformation', '#healthtok'],
      visual_tips: (parsed.visual_tips as string[]) || ['Start with a close-up', 'Use text overlays', 'Show before/after'],
      ai_generated: true,
    });
  } catch {
    return Response.json({
      hook: `This ${product} tip will CHANGE your life 🔥`,
      script: `[0s] You won't believe what ${product} did for ${target_audience}\n[5s] Here's the secret...\n[10s] Results in just 30 days\n[15s] Comment "INFO" to learn more`,
      cta: 'Follow for more wellness tips!',
      trending_sounds: ['Viral audio 2026', 'Aesthetic background music'],
      hashtags: ['#fyp', '#wellness', '#yoga', '#health', '#viral'],
      visual_tips: ['Bright lighting', 'Fast cuts', 'Text overlay on hook'],
      ai_generated: false,
      fallback: true,
    });
  }
}
