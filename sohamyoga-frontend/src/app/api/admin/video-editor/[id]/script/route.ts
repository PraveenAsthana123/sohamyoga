import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';
import { streamOllamaChat, type ChatMessage } from '@/lib/ollama';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const body = await req.json() as {
      platform?: string;
      type?: string;
      topic?: string;
      duration_seconds?: number;
      tone?: string;
      target_audience?: string;
    };

    const platform = body.platform || 'instagram';
    const type = body.type || 'reel';
    const topic = body.topic || 'yoga and wellness';
    const duration = body.duration_seconds || 30;
    const tone = body.tone || 'energetic';
    const audience = body.target_audience || 'wellness enthusiasts';

    const prompt = `Write a ${duration}s ${type} script for ${platform} about ${topic}. Tone: ${tone}. Audience: ${audience}. Include: Hook (first 3s), Main content, CTA. Format with timestamps like [0:00] Hook: ... [0:03] Main: ... [0:${duration - 5}] CTA: ... Keep it concise and platform-native.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are an expert social media video script writer specializing in short-form content. Write engaging, platform-optimized scripts.' },
      { role: 'user', content: prompt },
    ];

    let script = '';
    for await (const chunk of streamOllamaChat(messages)) {
      script += chunk;
    }

    if (!script.trim()) {
      script = `[0:00] Hook: Did you know ${topic} can transform your daily routine?\n[0:03] Main: Here's what you need to know about ${topic}...\n[0:${duration - 5}] CTA: Follow for more ${platform} content about ${topic}!`;
    }

    const wordCount = script.split(/\s+/).filter(Boolean).length;
    const estimatedDuration = Math.round(wordCount / 2.5);

    // Save to project
    if (params.id && params.id !== 'undefined') {
      await pool.query(
        `UPDATE video_projects SET ai_script=$1, updated_at=NOW() WHERE id=$2`,
        [script, params.id]
      );
    }

    return Response.json({ script, word_count: wordCount, estimated_duration_seconds: estimatedDuration });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
