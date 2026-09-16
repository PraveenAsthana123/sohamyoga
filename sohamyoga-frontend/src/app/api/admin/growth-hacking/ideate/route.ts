export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const { channel, goal } = body;
  if (!channel || !goal) return Response.json({ error: 'channel and goal required' }, { status: 400 });

  const prompt = `You are a growth hacker with 10+ years of experience. Generate exactly 5 growth experiment ideas for the following:
Channel: ${channel}
Goal: ${goal}

For each experiment, provide:
1. Experiment Name (short, catchy)
2. Hypothesis (if we do X, then Y will happen because Z)
3. Key Metric to track
4. Baseline assumption
5. Target lift %
6. Estimated duration (days)
7. Effort level (Low/Medium/High)

Format each experiment clearly numbered from 1 to 5. Be specific, actionable, and data-driven.`;

  try {
    const r = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    const d = await r.json();
    return Response.json({ ideas: d.response || '', channel, goal });
  } catch {
    return Response.json({ error: 'AI service unavailable' }, { status: 503 });
  }
}
