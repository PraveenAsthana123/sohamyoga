export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const { health_score = 0, kpis = [] } = body;

  const prompt = `You are a CRM and sales strategy analyst. Analyze the pipeline health and provide a CRM health report.

Health Score: ${health_score}/100
KPIs: ${JSON.stringify(kpis)}

Provide: 1) Pipeline health assessment, 2) Revenue risk analysis, 3) Lead conversion improvement recommendations, 4) Top 3 deals to prioritize this week.`;

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
      brief: `CRM Pipeline Health (Score: ${health_score}/100)\n\nSales pipeline is ${health_score >= 70 ? 'healthy and well-covered' : health_score >= 40 ? 'building momentum' : 'at risk — needs immediate attention'}.\n\nPriority Actions:\n1. Focus on deals in negotiation stage — highest close probability\n2. Increase lead qualification calls to improve conversion rate\n3. Review deals closing this month and remove blockers\n4. Schedule pipeline review meeting with sales team\n\nNote: AI advisor unavailable — fallback analysis shown.`,
      model: 'fallback',
      generated_at: new Date().toISOString(),
    });
  }
}
