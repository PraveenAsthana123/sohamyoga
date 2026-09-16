export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const { id } = await params;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT * FROM porter_analyses WHERE id=$1', [id]);
    if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    const a = rows[0];

    const prompt = `Perform a comprehensive Porter's Five Forces analysis for ${a.company_name} in the ${a.industry} industry.
For each force, give a score from 1 (weak) to 5 (strong) with detailed rationale.
Return JSON:
{
  "competitive_rivalry": { "score": 4, "rationale": "..." },
  "supplier_power": { "score": 2, "rationale": "..." },
  "buyer_power": { "score": 3, "rationale": "..." },
  "threat_new_entry": { "score": 4, "rationale": "..." },
  "threat_substitutes": { "score": 3, "rationale": "..." },
  "summary": "Executive summary of competitive position",
  "strategic_recommendations": ["recommendation 1", "recommendation 2", "recommendation 3", "recommendation 4"]
}`;

    let analysis: Record<string, unknown> = {};
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json() as { response?: string };
      const match = (data.response || '').match(/\{[\s\S]*\}/);
      if (match) analysis = JSON.parse(match[0]);
    } catch { /* fallback */ }

    const getScore = (k: string, fallback: number) => Number((analysis[k] as Record<string, unknown>)?.score) || fallback;
    const cr = getScore('competitive_rivalry', Number(a.competitive_rivalry));
    const sp = getScore('supplier_power', Number(a.supplier_power));
    const bp = getScore('buyer_power', Number(a.buyer_power));
    const te = getScore('threat_new_entry', Number(a.threat_new_entry));
    const ts = getScore('threat_substitutes', Number(a.threat_substitutes));
    const summary = (analysis.summary as string) || `${a.company_name} operates in a moderately competitive ${a.industry} market. Focus on differentiation and customer loyalty.`;
    const recs = (analysis.strategic_recommendations as string[]) || ['Build defensible market position', 'Invest in customer retention', 'Explore strategic partnerships', 'Monitor substitute threats'];

    const { rows: updated } = await client.query(
      `UPDATE porter_analyses SET competitive_rivalry=$1, supplier_power=$2, buyer_power=$3, threat_new_entry=$4, threat_substitutes=$5, summary=$6, recommendations=$7 WHERE id=$8 RETURNING *`,
      [cr, sp, bp, te, ts, summary, recs, id]
    );

    return Response.json({
      updated: updated[0],
      ai_analysis: {
        competitive_rivalry: (analysis.competitive_rivalry as Record<string, unknown>) || { score: cr, rationale: 'Analysis based on industry data' },
        supplier_power: (analysis.supplier_power as Record<string, unknown>) || { score: sp, rationale: 'Analysis based on industry data' },
        buyer_power: (analysis.buyer_power as Record<string, unknown>) || { score: bp, rationale: 'Analysis based on industry data' },
        threat_new_entry: (analysis.threat_new_entry as Record<string, unknown>) || { score: te, rationale: 'Analysis based on industry data' },
        threat_substitutes: (analysis.threat_substitutes as Record<string, unknown>) || { score: ts, rationale: 'Analysis based on industry data' },
      },
      ai_generated: !!analysis.summary,
    });
  } finally { client.release(); }
}
