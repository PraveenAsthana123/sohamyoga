import { NextRequest } from 'next/server';

import { requireAdmin } from '@/lib/admin-auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { text, action, topic, audience, tone } = await req.json() as {
    text?: string; action?: string; topic?: string; audience?: string; tone?: string;
  };

  let prompt = '';

  if (action === 'check-voice') {
    prompt = `You are a brand voice analyst. Analyze the following text for tone, formality, and brand alignment for a wellness/yoga brand.
Text: "${text}"
Respond with JSON: { "score": <0-100>, "tone": "<detected tone>", "formality": "<high|medium|low>", "brand_alignment": "<strong|moderate|weak>", "suggestions": ["suggestion1", "suggestion2", "suggestion3"] }
Only return valid JSON.`;
  } else if (action === 'generate-tagline') {
    prompt = `Generate 3 compelling taglines for a yoga/wellness brand targeting ${audience || 'health-conscious adults'}.
Tone: ${tone || 'inspirational and professional'}.
Respond with JSON: { "taglines": ["tagline1", "tagline2", "tagline3"] }
Only return valid JSON.`;
  } else if (action === 'generate-elevator-pitch') {
    prompt = `Write a concise 30-second elevator pitch for a yoga/wellness brand.
Topic: ${topic || 'yoga and mindfulness services'}. Audience: ${audience || 'busy professionals'}.
Respond with JSON: { "pitch": "<elevator pitch text>" }
Only return valid JSON.`;
  } else if (action === 'generate-value-prop') {
    prompt = `Write 3 compelling value propositions for a yoga/wellness brand.
Topic: ${topic || 'yoga classes and wellness programs'}. Target audience: ${audience || 'working adults'}.
Respond with JSON: { "value_props": ["value_prop1", "value_prop2", "value_prop3"] }
Only return valid JSON.`;
  } else if (action === 'generate-guideline') {
    prompt = `You are a brand strategist. Generate brand guideline content for the "${topic}" section of a yoga/wellness brand.
Include what to do, what to avoid. Respond with JSON: { "content": "<detailed guideline>", "do_examples": "<3 do examples>", "dont_examples": "<3 dont examples>" }
Only return valid JSON.`;
  } else if (action === 'generate-assets-checklist') {
    prompt = `Generate a comprehensive brand assets checklist for a yoga/wellness brand. List 15 specific missing or recommended assets.
Respond with JSON: { "checklist": ["asset1", "asset2", ...] }
Only return valid JSON.`;
  } else if (action === 'analyze-differentiation') {
    prompt = `As a brand strategist, analyze how a yoga/wellness brand can differentiate from competitors.
Provide 5 specific differentiation strategies. Respond with JSON: { "strategies": [{"title": "...", "description": "..."}] }
Only return valid JSON.`;
  } else if (action === 'generate-template') {
    prompt = `Generate a ${topic || 'social post'} template for a yoga/wellness brand.
Include placeholder variables like [PRODUCT_NAME], [BENEFIT], [CTA], [DATE].
Respond with JSON: { "template": "<template text with variables>" }
Only return valid JSON.`;
  } else if (action === 'ai-recommendations') {
    prompt = `Based on brand health metrics for a yoga/wellness brand, provide 5 specific, actionable recommendations to improve brand health.
Respond with JSON: { "recommendations": [{"area": "...", "action": "...", "priority": "high|medium|low"}] }
Only return valid JSON.`;
  } else {
    return Response.json({ error: 'Unknown action' }, { status: 400 });
  }

  try {
    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
    });

    if (!ollamaRes.ok) throw new Error(`Ollama error: ${ollamaRes.status}`);
    const ollamaData = await ollamaRes.json() as { response?: string };
    const raw = (ollamaData.response ?? '').trim();

    // Extract JSON from response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return Response.json({ result: raw });

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    return Response.json({ result: parsed });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
