import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface GenerateRequest {
  topic: string;
  audience?: string;
  post_type?: string;
  tone?: string;
}

interface GenerateResult {
  content: string;
  hashtags: string;
  cta: string;
  ai_generated: boolean;
}

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = 'llama3.2';

function buildFallback(topic: string, tone: string, postType: string): GenerateResult {
  const toneMap: Record<string, string> = {
    professional: 'As a wellness professional, I want to share',
    casual: 'Hey connections! Just wanted to share',
    'thought-leader': 'After years of working with organizations on',
    educational: 'Did you know that',
  };

  const opener = toneMap[tone] ?? toneMap['professional'];
  const content = `${opener} something important about ${topic}.

The impact of ${topic} on modern workplaces cannot be overstated. Organizations that invest in their employees' wellbeing see measurable improvements in productivity, retention, and culture.

${postType === 'poll' ? '' : 'What has been your experience? I\'d love to hear your thoughts in the comments.'}`;

  return {
    content: content.trim(),
    hashtags: `#${topic.replace(/\s+/g, '')} #wellness #mindfulness #leadership #corporateculture`,
    cta: "Drop a comment below — what's your biggest challenge with this topic?",
    ai_generated: false,
  };
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  try {
    const body = await req.json() as GenerateRequest;

    if (!body.topic) {
      return NextResponse.json({ error: 'topic is required' }, { status: 400 });
    }

    const tone = body.tone ?? 'professional';
    const audience = body.audience ?? 'professionals';
    const postType = body.post_type ?? 'text';

    const prompt = `You are a LinkedIn content expert for a corporate wellness and yoga company.

Write a compelling LinkedIn ${postType} post about: "${body.topic}"

Requirements:
- Tone: ${tone}
- Target audience: ${audience}
- Post type: ${postType}
- Length: 150-300 words
- Include a clear value proposition
- End with a question or CTA to drive engagement
- Do NOT use excessive emojis (max 2)

Also provide:
- 5-7 relevant hashtags (as a single string like: #hashtag1 #hashtag2)
- A short, punchy call-to-action sentence

Respond in this EXACT JSON format (no other text):
{
  "content": "the post text here",
  "hashtags": "#tag1 #tag2 #tag3",
  "cta": "the call to action here"
}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const ollamaRes = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt,
          stream: false,
          options: { temperature: 0.7, num_predict: 512 },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!ollamaRes.ok) {
        return NextResponse.json(buildFallback(body.topic, tone, postType));
      }

      const ollamaData = await ollamaRes.json() as { response?: string };
      const rawText = ollamaData.response ?? '';

      // Extract JSON from response
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return NextResponse.json({ ...buildFallback(body.topic, tone, postType), content: rawText.trim() || buildFallback(body.topic, tone, postType).content });
      }

      const parsed = JSON.parse(jsonMatch[0]) as { content?: string; hashtags?: string; cta?: string };
      return NextResponse.json({
        content: parsed.content ?? buildFallback(body.topic, tone, postType).content,
        hashtags: parsed.hashtags ?? `#${body.topic.replace(/\s+/g, '')} #wellness`,
        cta: parsed.cta ?? 'Share your thoughts in the comments!',
        ai_generated: true,
      } satisfies GenerateResult);

    } catch (fetchErr) {
      clearTimeout(timeoutId);
      if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
        return NextResponse.json(buildFallback(body.topic, tone, postType));
      }
      return NextResponse.json(buildFallback(body.topic, tone, postType));
    }
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
