export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool(); const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT * FROM consulting_opportunities WHERE id=$1', [params.id]);
    if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    const opp = rows[0];
    const reqList = Array.isArray(opp.requirements) ? opp.requirements as Array<{ title: string; priority: string; status: string }> : [];
    const reqText = reqList.map(r => `- ${r.title} (priority: ${r.priority}, status: ${r.status})`).join('\n');

    const prompt = `You are a senior solutions architect / presales consultant. Generate a high-level solution design for this client.

Client: ${opp.client_name}
Contact: ${opp.contact || 'not specified'}
Description: ${opp.description || 'not specified'}
Budget: $${opp.value?.toLocaleString() || 'TBD'}
Requirements:
${reqText || 'No requirements defined yet'}

Write a professional solution design covering:
1. Executive Summary (2-3 sentences)
2. Proposed Architecture (3-4 bullet points)
3. Implementation Phases (3-4 phases with timelines)
4. Key Risks & Mitigations (2-3 items)
5. Success Metrics (3-4 KPIs)

Keep it concise — suitable for a presales proposal. Under 300 words.`;

    let solution_design = opp.solution_design || 'No solution design generated yet. Requirements not sufficient for AI generation.';

    try {
      const aiRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        solution_design = aiData.response || solution_design;
      }
    } catch { /* fallback */ }

    await client.query('UPDATE consulting_opportunities SET solution_design=$1 WHERE id=$2', [solution_design, params.id]);
    return Response.json({ solution_design });
  } finally { client.release(); }
}
