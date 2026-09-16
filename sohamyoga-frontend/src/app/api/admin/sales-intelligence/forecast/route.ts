export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows: deals } = await client.query(`SELECT * FROM sales_intel_deals WHERE stage NOT IN ('closed won','closed lost')`);
    const pipeline = deals.reduce((s, d) => s + Number(d.value), 0);
    const weighted = deals.reduce((s, d) => s + Number(d.value) * Number(d.probability) / 100, 0);
    const byStage: Record<string, { count: number; value: number; weighted: number }> = {};
    deals.forEach(d => {
      if (!byStage[d.stage]) byStage[d.stage] = { count: 0, value: 0, weighted: 0 };
      byStage[d.stage].count++;
      byStage[d.stage].value += Number(d.value);
      byStage[d.stage].weighted += Number(d.value) * Number(d.probability) / 100;
    });

    let commentary = '';
    try {
      const prompt = `You are a sales forecast analyst. Analyze this pipeline in 2 sentences:
Total open pipeline: $${pipeline.toFixed(0)}
Weighted forecast: $${weighted.toFixed(0)}
By stage: ${JSON.stringify(byStage)}

Provide: 1) Pipeline health assessment, 2) Key risk or opportunity this week.`;
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json() as { response?: string };
      commentary = data.response || '';
    } catch { /* fallback */ }

    return Response.json({
      pipeline_total: pipeline,
      weighted_forecast: weighted,
      by_stage: byStage,
      deal_count: deals.length,
      ai_commentary: commentary || `Pipeline of $${pipeline.toFixed(0)} with ${weighted.toFixed(0)} weighted forecast. Focus on the negotiation stage deals to maximize near-term closings.`,
      ai_generated: !!commentary,
    });
  } finally { client.release(); }
}
