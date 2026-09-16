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
    const { rows } = await client.query('SELECT * FROM lead_management_leads WHERE id=$1', [params.id]);
    if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    const lead = rows[0];
    const icpRows = await client.query('SELECT * FROM lead_management_icp LIMIT 5');
    const icpContext = icpRows.rows.map(r => `ICP "${r.name}": industry=${r.industry}, size=${r.company_size}, pain_points=${(r.pain_points||[]).join(', ')}`).join('\n');
    const enrichment = lead.enrichment_data ? JSON.stringify(lead.enrichment_data) : 'none';
    const prompt = `You are a B2B lead scoring expert. Score this lead 0-100 and provide reasoning.

Lead details:
- Name: ${lead.name}
- Company: ${lead.company || 'unknown'}
- Source: ${lead.source || 'unknown'}
- Current status: ${lead.status}
- Enrichment data: ${enrichment}

Ideal Customer Profiles:
${icpContext || 'No ICPs defined yet.'}

Return ONLY valid JSON: {"score": <number 0-100>, "icp_fit": "<strong|medium|weak>", "reasoning": "<2-3 sentence explanation>", "top_signals": ["signal1","signal2","signal3"]}`;

    let score = lead.score;
    let reasoning = 'AI scoring unavailable — score unchanged.';
    let icp_fit = lead.icp_fit || 'medium';
    let top_signals: string[] = [];

    try {
      const aiRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const text = aiData.response || '';
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          score = Math.min(100, Math.max(0, parseInt(parsed.score) || score));
          reasoning = parsed.reasoning || reasoning;
          icp_fit = parsed.icp_fit || icp_fit;
          top_signals = parsed.top_signals || [];
        }
      }
    } catch { /* Ollama unavailable — use current score */ }

    await client.query('UPDATE lead_management_leads SET score=$1, icp_fit=$2 WHERE id=$3', [score, icp_fit, params.id]);
    return Response.json({ score, icp_fit, reasoning, top_signals });
  } finally { client.release(); }
}
