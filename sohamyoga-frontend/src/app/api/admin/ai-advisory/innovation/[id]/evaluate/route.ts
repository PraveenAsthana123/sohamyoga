export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`SELECT * FROM innovation_lab_ideas WHERE id=$1`, [params.id]);
    if (rows.length === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    const idea = rows[0];

    const prompt = `You are an AI innovation strategist. Evaluate this idea for a yoga & wellness enterprise:

Title: ${idea.title}
Category: ${idea.category}
Description: ${idea.description}
Current feasibility: ${idea.feasibility}
Expected impact: ${idea.impact}

Provide evaluation as JSON:
{
  "feasibility_score": 1-10,
  "impact_score": 1-10,
  "technical_complexity": "low/medium/high",
  "estimated_effort_weeks": number,
  "estimated_roi_pct": number,
  "required_capabilities": ["list"],
  "risks": ["list of 2-3 risks"],
  "recommendation": "approve/pilot/reject/defer",
  "next_step": "one actionable next step"
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
      const evaluation = match ? JSON.parse(match[0]) : null;
      return Response.json({ idea_title: idea.title, evaluation, raw: text });
    } catch {
      return Response.json({
        idea_title: idea.title,
        evaluation: {
          feasibility_score: 7,
          impact_score: 8,
          technical_complexity: idea.feasibility,
          estimated_effort_weeks: 6,
          estimated_roi_pct: 25,
          required_capabilities: ['Ollama local inference', 'Next.js API routes'],
          risks: ['Data quality for personalization', 'User adoption curve'],
          recommendation: 'pilot',
          next_step: 'Define KPIs and run 4-week PoC',
        },
        raw: 'Ollama unavailable — static evaluation',
      });
    }
  } finally {
    client.release();
  }
}
