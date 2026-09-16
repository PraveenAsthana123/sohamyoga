import { NextRequest } from 'next/server';

import { requireAdmin } from '@/lib/admin-auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { topic, audience, tone, length, action, text } = await req.json() as {
    topic?: string; audience?: string; tone?: string; length?: string;
    action?: string; text?: string;
  };

  let prompt = '';

  if (action === 'generate-seo') {
    prompt = `Generate SEO metadata for a blog post titled "${topic}".
Respond with JSON: { "seo_title": "<60 chars>", "seo_description": "<160 chars>", "seo_keywords": "<comma-separated keywords>" }
Only return valid JSON.`;
  } else if (action === 'suggest-tags') {
    prompt = `Suggest 8 relevant blog tags for a yoga/wellness blog post about: "${topic}".
Respond with JSON: { "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8"] }
Only return valid JSON.`;
  } else if (action === 'write-intro') {
    prompt = `Write a compelling 3-paragraph introduction for a blog post titled "${topic}" for a yoga/wellness brand.
Target audience: ${audience || 'wellness enthusiasts'}. Tone: ${tone || 'inspirational and informative'}.
Respond with JSON: { "introduction": "<3 paragraphs of intro text>" }
Only return valid JSON.`;
  } else if (action === 'fix-seo') {
    prompt = `Generate complete SEO metadata for this blog post: "${text}".
Respond with JSON: { "seo_title": "<title>", "seo_description": "<description>", "seo_keywords": "<keywords>" }
Only return valid JSON.`;
  } else {
    // Full post generation
    const wordTarget = length === 'short' ? '500-700' : length === 'long' ? '1500-2000' : '800-1200';
    prompt = `Write a complete, high-quality blog post for a yoga/wellness brand.
Topic: ${topic || 'Benefits of daily yoga practice'}
Target audience: ${audience || 'busy professionals'}
Tone: ${tone || 'inspirational and practical'}
Word count: approximately ${wordTarget} words

Include: engaging title, introduction, 3-5 main sections with headers, actionable tips, conclusion.
Respond with JSON: {
  "title": "<post title>",
  "excerpt": "<2-sentence excerpt>",
  "content": "<full markdown content>",
  "tags": ["tag1", "tag2", "tag3"],
  "seo_title": "<seo title>",
  "seo_description": "<meta description>"
}
Only return valid JSON.`;
  }

  try {
    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
    });

    if (!ollamaRes.ok) throw new Error(`Ollama error: ${ollamaRes.status}`);
    const data = await ollamaRes.json() as { response?: string };
    const raw = (data.response ?? '').trim();

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return Response.json({ result: { content: raw } });

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    return Response.json({ result: parsed });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
