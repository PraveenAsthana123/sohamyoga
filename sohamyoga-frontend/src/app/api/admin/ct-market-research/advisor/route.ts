export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const { health_score = 0, kpis = [], alerts = [] } = body;

  const prompt = `You are a market intelligence analyst. Based on the following market research control tower data, generate a concise strategic brief (3-4 paragraphs) with actionable recommendations.

Health Score: ${health_score}/100
KPIs: ${JSON.stringify(kpis)}
Open Alerts: ${alerts.length}
Alert Details: ${JSON.stringify(alerts.slice(0, 3))}

Provide: 1) Current market intelligence health assessment, 2) Key gaps and risks, 3) Top 3 recommended actions for this week, 4) Strategic opportunities identified.`;

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
      brief: `Market Intelligence Health Assessment (Score: ${health_score}/100)\n\nCurrent status indicates ${health_score >= 70 ? 'healthy' : health_score >= 40 ? 'moderate' : 'critical'} market intelligence coverage. ${alerts.length} open alerts require attention.\n\nRecommended Actions:\n1. Schedule Porter Five Forces analysis for top 3 verticals\n2. Increase technology scouting frequency to weekly cadence\n3. Set up automated competitor monitoring for pricing changes\n\nNote: AI advisor is currently unavailable — this is a fallback summary.`,
      model: 'fallback',
      generated_at: new Date().toISOString(),
    });
  }
}
