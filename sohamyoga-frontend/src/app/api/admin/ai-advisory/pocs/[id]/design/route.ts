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
    const { rows } = await client.query(`SELECT * FROM ai_pocs WHERE id=$1`, [params.id]);
    if (rows.length === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    const poc = rows[0];

    const prompt = `You are an AI solutions architect. Design a detailed PoC (Proof of Concept) document for:

Name: ${poc.name}
Use Case: ${poc.use_case}
Hypothesis: ${poc.hypothesis}
Success Criteria: ${poc.success_criteria}
Tech Stack: ${(poc.tech_stack ?? []).join(', ')}
Duration: ${poc.duration_weeks} weeks

Generate a PoC design document with:
1. Refined hypothesis (3 sentences)
2. KPIs (5 measurable metrics)
3. Risks (3 risks with mitigation)
4. 4-week sprint plan (week 1-4 with specific tasks)
5. Data requirements
6. Expected outcomes

Be specific and actionable. Keep it under 500 words.`;

    try {
      const ollamaRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await ollamaRes.json();
      return Response.json({ poc_name: poc.name, design_document: data.response ?? 'No response from Ollama' });
    } catch {
      return Response.json({
        poc_name: poc.name,
        design_document: `PoC Design: ${poc.name}\n\nHypothesis: ${poc.hypothesis}\n\nKPIs: ${poc.success_criteria}\n\nWeek 1: Environment setup + data collection\nWeek 2: Model training/fine-tuning\nWeek 3: Integration + testing\nWeek 4: Evaluation + decision\n\n[Ollama unavailable — static outline]`,
      });
    }
  } finally {
    client.release();
  }
}
