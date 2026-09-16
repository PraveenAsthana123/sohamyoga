export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured } from '@/lib/postgres';

export async function POST(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const { org_description } = body;
  if (!org_description) return Response.json({ error: 'org_description required' }, { status: 400 });

  const prompt = `You are an AI maturity assessment expert using the 5-level AI maturity model.

Organization description: ${org_description}

Score this organization across 6 dimensions (1=Initial, 2=Developing, 3=Defined, 4=Managed, 5=Optimizing):
- Strategy: AI vision, roadmap, executive sponsorship, investment
- Data: Data quality, governance, availability, feature engineering
- Technology: Infrastructure, tools, MLOps, model serving
- People: AI talent, skills, training, culture
- Governance: AI ethics, risk management, compliance, accountability
- Culture: Innovation mindset, AI adoption, change management

Respond as JSON:
{
  "Strategy": {"score": 1-5, "evidence": "...", "gap_actions": ["action1","action2"]},
  "Data": {"score": 1-5, "evidence": "...", "gap_actions": ["action1","action2"]},
  "Technology": {"score": 1-5, "evidence": "...", "gap_actions": ["action1","action2"]},
  "People": {"score": 1-5, "evidence": "...", "gap_actions": ["action1","action2"]},
  "Governance": {"score": 1-5, "evidence": "...", "gap_actions": ["action1","action2"]},
  "Culture": {"score": 1-5, "evidence": "...", "gap_actions": ["action1","action2"]},
  "overall_level": 1-5,
  "key_recommendation": "single most important action"
}`;

  try {
    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await ollamaRes.json();
    const text = data.response ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    const assessment = match ? JSON.parse(match[0]) : null;
    return Response.json({ org_description, assessment, raw: text });
  } catch {
    return Response.json({
      org_description,
      assessment: {
        Strategy: { score: 2, evidence: 'No formal AI strategy found in description', gap_actions: ['Define AI roadmap', 'Appoint AI champion'] },
        Data: { score: 2, evidence: 'Data infrastructure not detailed', gap_actions: ['Audit data quality', 'Build data catalog'] },
        Technology: { score: 2, evidence: 'Technology stack unclear', gap_actions: ['Deploy local inference', 'Implement monitoring'] },
        People: { score: 1, evidence: 'No AI skills mentioned', gap_actions: ['Train staff on AI basics', 'Hire ML talent'] },
        Governance: { score: 1, evidence: 'No governance framework described', gap_actions: ['Create AI policy', 'Establish review board'] },
        Culture: { score: 2, evidence: 'Culture unclear from description', gap_actions: ['Run AI awareness workshops', 'Celebrate AI wins'] },
        overall_level: 2,
        key_recommendation: 'Start with an AI literacy program and a single high-value PoC to build momentum',
      },
      raw: 'Ollama unavailable — static fallback',
    });
  }
}
