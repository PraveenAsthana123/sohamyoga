import { NextRequest } from 'next/server';
import { submitGoal, agentHealth } from '@/lib/agent';

// Portal → agentic Ollama gateway bridge.
//   GET  /api/ai/agent        → gateway readiness
//   POST /api/ai/agent {goal} → plan a goal on Ollama, queue tasks (cron executes)
// Filesystem route: wins over the next.config.js /api/* → .NET rewrite.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_GOAL = 2000;

export async function GET() {
  const health = await agentHealth();
  return Response.json(health, { status: health.ok ? 200 : 503 });
}

export async function POST(req: NextRequest) {
  let body: { goal?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const goal = typeof body.goal === 'string' ? body.goal.trim().slice(0, MAX_GOAL) : '';
  if (!goal) {
    return Response.json({ error: 'A non-empty "goal" is required' }, { status: 400 });
  }

  try {
    const result = await submitGoal(goal);
    return Response.json(result, { status: 202 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'gateway error';
    return Response.json(
      { error: 'The agent gateway is unavailable.', details: msg },
      { status: 503 },
    );
  }
}
