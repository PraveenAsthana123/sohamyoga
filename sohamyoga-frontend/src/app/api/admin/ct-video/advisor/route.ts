export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const { health_score = 0, kpis = [] } = body;

  const prompt = `You are a video production director. Analyze the following production metrics and provide a status brief with bottleneck analysis.

Health Score: ${health_score}/100
KPIs: ${JSON.stringify(kpis)}

Provide: 1) Production pipeline health, 2) Key bottlenecks identified, 3) Recommended process improvements, 4) Output optimization suggestions.`;

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
      brief: `Video Production Health (Score: ${health_score}/100)\n\nProduction pipeline is ${health_score >= 70 ? 'running smoothly' : health_score >= 40 ? 'partially active' : 'stalled'}.\n\nRecommended Actions:\n1. Review queued post-production jobs for blockers\n2. Ensure script-to-storyboard pipeline is populated\n3. Set up weekly video output targets\n\nNote: AI advisor unavailable — fallback summary shown.`,
      model: 'fallback',
      generated_at: new Date().toISOString(),
    });
  }
}
