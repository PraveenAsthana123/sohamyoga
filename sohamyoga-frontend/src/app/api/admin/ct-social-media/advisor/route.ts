export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const { health_score = 0, kpis = [] } = body;

  const prompt = `You are a social media strategist. Based on these metrics, generate a concise social media performance summary (3-4 paragraphs) with specific recommendations.

Health Score: ${health_score}/100
KPIs: ${JSON.stringify(kpis)}

Provide: 1) Overall social media health assessment, 2) Platform performance gaps, 3) Top 3 content recommendations for this week, 4) Engagement growth opportunities.`;

  try {
    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!ollamaRes.ok) throw new Error('Ollama error');
    const data = await ollamaRes.json();
    return Response.json({ brief: data.response, model: 'llama3.2', generated_at: new Date().toISOString() });
  } catch {
    return Response.json({
      brief: `Social Media Health Assessment (Score: ${health_score}/100)\n\nYour social presence is ${health_score >= 70 ? 'performing well' : health_score >= 40 ? 'showing moderate activity' : 'underperforming'} across connected platforms.\n\nRecommended Actions:\n1. Increase posting frequency to at least 1 post/day across all active platforms\n2. Activate TikTok ad campaigns to boost reach\n3. Engage influencer network for content amplification\n\nNote: AI advisor unavailable — fallback summary shown.`,
      model: 'fallback',
      generated_at: new Date().toISOString(),
    });
  }
}
