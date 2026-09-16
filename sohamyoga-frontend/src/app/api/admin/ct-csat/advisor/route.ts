export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => ({}));
    const { avg_csat = 0, nps = 0, escalations = 0, drivers = [] } = body;

    const prompt = `You are a CX specialist. Analyze this customer satisfaction data and provide 5 specific, actionable improvement recommendations.

CSAT Data:
- Average CSAT Score: ${avg_csat}/5
- NPS Score: ${nps}
- Open Escalations: ${escalations}
- Top Complaint Drivers: ${JSON.stringify(drivers)}

Provide recommendations as a numbered list. Focus on quick wins and systemic improvements. Be specific and practical.`;

    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });

    if (!ollamaRes.ok) throw new Error('Ollama unavailable');
    const ollamaJson = await ollamaRes.json();
    return Response.json({ brief: ollamaJson.response ?? 'No response generated.' });
  } catch {
    return Response.json({ brief: 'AI Advisor temporarily unavailable. Key recommendations: (1) Follow up on all escalations within 24h, (2) Train instructors on areas with lowest scores, (3) Add post-class text surveys for higher response rates, (4) Benchmark CSAT targets quarterly, (5) Create a closed-loop feedback program.' });
  }
}
