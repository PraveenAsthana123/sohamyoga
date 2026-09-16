export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const { health_score = 0, kpis = [] } = body;

  const prompt = `You are an omnichannel CX strategist. Analyze channel gaps and identify improvement opportunities.

Health Score: ${health_score}/100
KPIs: ${JSON.stringify(kpis)}

Provide: 1) Omnichannel health assessment, 2) Channel gaps identified, 3) Journey stage drop-off analysis, 4) Top 3 CX improvement recommendations.`;

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
      brief: `Omnichannel CX Health (Score: ${health_score}/100)\n\nChannel coverage is ${health_score >= 70 ? 'comprehensive' : health_score >= 40 ? 'partial' : 'fragmented'}.\n\nKey Gaps Identified:\n1. Response time exceeds 30 minutes on social channels — set up auto-reply\n2. Journey completion drops at retention stage — add loyalty touchpoints\n3. WhatsApp resolution rate is lowest — needs dedicated support flow\n\nNote: AI advisor unavailable — fallback analysis shown.`,
      model: 'fallback',
      generated_at: new Date().toISOString(),
    });
  }
}
