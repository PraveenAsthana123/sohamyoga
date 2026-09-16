import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { topic, adType, platform, existing } = body;

  if (!topic || !adType || !platform) {
    return Response.json({ error: 'topic, adType, platform required' }, { status: 400 });
  }

  const prompt = `You are an expert ad copywriter. Write a "${adType.replace(/_/g, ' ')}" style ad for platform "${platform}".
Topic: ${topic}
${existing ? `Existing context: ${existing}` : ''}
Requirements:
- Headline: max 90 chars, punchy, uses the ${adType.replace(/_/g, ' ')} formula
- Body: max 150 words, compelling, ends with clear benefit
- CTA: one of [Learn More, Buy Now, Sign Up, Get Quote, Book Now]
- Hashtags: 5 relevant hashtags
- Emojis: 3 relevant emojis that fit the tone

Respond in JSON: { "headline": "...", "body": "...", "cta": "...", "hashtags": ["..."], "emojis": ["..."] }`;

  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false, format: 'json' }),
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      throw new Error(`Ollama returned ${response.status}`);
    }

    const data = await response.json();
    let parsed: { headline?: string; body?: string; cta?: string; hashtags?: string[]; emojis?: string[] } = {};
    try {
      parsed = JSON.parse(data.response || '{}');
    } catch {
      parsed = {};
    }

    return Response.json({
      headline: parsed.headline || `${topic} — Discover More`,
      body: parsed.body || `Learn everything about ${topic} and how it can transform your life.`,
      cta: parsed.cta || 'Learn More',
      hashtags: parsed.hashtags || [`#${topic.replace(/\s+/g, '')}`, '#Marketing', '#Growth'],
      emojis: parsed.emojis || ['🚀', '✨', '💡'],
      model: 'llama3.2'
    });
  } catch (err) {
    // Fallback if Ollama is unavailable
    const fallback = generateFallback(topic, adType, platform);
    return Response.json({
      ...fallback,
      model: 'fallback',
      error: err instanceof Error ? err.message : 'Ollama unavailable'
    });
  }
}

function generateFallback(topic: string, adType: string, platform: string) {
  const templates: Record<string, { headline: string; body: string; cta: string }> = {
    topic: { headline: `Everything About ${topic}`, body: `Dive deep into ${topic}. Get expert insights, tips, and strategies.`, cta: 'Learn More' },
    dos_donts: { headline: `${topic}: Do's & Don'ts`, body: `Avoid the common mistakes with ${topic}. Here's exactly what works and what doesn't.`, cta: 'Get Guide' },
    best_practices: { headline: `Best Practices for ${topic}`, body: `Top professionals rely on these proven ${topic} best practices. Start applying them today.`, cta: 'Learn More' },
    knowledge: { headline: `${topic}: What You Need to Know`, body: `Essential knowledge about ${topic} that will change how you approach your goals.`, cta: 'Discover' },
    mistake_based: { headline: `Stop Making These ${topic} Mistakes`, body: `87% of people get ${topic} wrong. Here's how to avoid the most costly errors.`, cta: 'Learn More' },
    risk_based: { headline: `The Hidden Risks of ${topic}`, body: `Protect yourself. Understanding ${topic} risks before it's too late can save you time and money.`, cta: 'Get Protected' },
    value_focused: { headline: `Unlock Real Value with ${topic}`, body: `See exactly how ${topic} delivers measurable results and ROI for your goals.`, cta: 'See Results' },
    productivity: { headline: `Double Your ${topic} Productivity`, body: `Work smarter, not harder. These ${topic} productivity hacks save hours every week.`, cta: 'Start Now' },
    cost_saving: { headline: `Save Big on ${topic}`, body: `Reduce your ${topic} costs by up to 40%. Smart strategies that pay for themselves.`, cta: 'Calculate Savings' },
    technology: { headline: `${topic} Powered by AI`, body: `Leverage cutting-edge technology for ${topic}. Stay ahead with smart, automated solutions.`, cta: 'See How' },
  };
  const t = templates[adType] || templates.topic;
  const platformTags: Record<string, string[]> = {
    instagram: ['#reels', '#instagood'],
    linkedin: ['#professional', '#business'],
    tiktok: ['#fyp', '#trending'],
  };
  return {
    headline: t.headline,
    body: t.body,
    cta: t.cta,
    hashtags: [`#${topic.replace(/\s+/g, '')}`, `#${adType.replace(/_/g, '')}`, ...(platformTags[platform] || ['#marketing', '#digital'])].slice(0, 5),
    emojis: ['🚀', '✨', '💡']
  };
}
