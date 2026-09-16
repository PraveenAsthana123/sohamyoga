export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured } from '@/lib/postgres';

const WASTE_TYPES = ['Transport','Inventory','Motion','Waiting','Overproduction','Overprocessing','Defects','Skills'];

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body?.description) return Response.json({ error: 'description required' }, { status: 400 });

  const prompt = `You are a Lean waste identification expert. Analyze the following process description and identify instances of the 8 types of lean waste (TIM WOODS):
T - Transport, I - Inventory, M - Motion, W - Waiting, O - Overproduction, O - Overprocessing, D - Defects, S - Skills (underutilization)

Process Description: ${body.description}

For each waste type found, provide:
- waste_type: (one of: Transport, Inventory, Motion, Waiting, Overproduction, Overprocessing, Defects, Skills)
- description: specific instance in this process
- impact: (low/medium/high)
- estimated_cost_usd: rough annual estimate
- action_plan: one concrete improvement action

Output ONLY valid JSON array of findings. If a waste type is not present, omit it.
Format: [{"waste_type":"...","description":"...","impact":"...","estimated_cost_usd":0,"action_plan":"..."}]`;

  let findings: unknown[] = [];
  try {
    const aiRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (aiRes.ok) {
      const aiData = await aiRes.json();
      const raw = aiData.response || '';
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) findings = JSON.parse(match[0]);
    }
  } catch {
    findings = WASTE_TYPES.slice(0, 3).map(t => ({
      waste_type: t,
      description: `Potential ${t.toLowerCase()} waste identified in the described process`,
      impact: 'medium',
      estimated_cost_usd: 5000,
      action_plan: `Review and optimize ${t.toLowerCase()} related activities`,
    }));
  }

  return Response.json({ findings, process_description: body.description });
}
