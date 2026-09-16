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
    const { rows } = await client.query('SELECT * FROM conversion_experiments WHERE id=$1', [params.id]);
    if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    const exp = rows[0];
    const controlRate = exp.control_visitors > 0 ? parseFloat((exp.control_conversions / exp.control_visitors * 100).toFixed(2)) : 0;
    const testRate = exp.test_visitors > 0 ? parseFloat((exp.test_conversions / exp.test_visitors * 100).toFixed(2)) : 0;
    const uplift = controlRate > 0 ? (((testRate - controlRate) / controlRate) * 100).toFixed(1) : '0';

    const prompt = `You are a conversion rate optimization expert. Analyze this A/B test and provide a recommendation.

Experiment: "${exp.name}"
Hypothesis: ${exp.hypothesis || 'not specified'}
Control: "${exp.control_variant}" — ${exp.control_conversions} conversions / ${exp.control_visitors} visitors = ${controlRate}% rate
Test: "${exp.test_variant}" — ${exp.test_conversions} conversions / ${exp.test_visitors} visitors = ${testRate}% rate
Uplift: ${uplift}%
Metric: ${exp.metric || 'conversion rate'}
Status: ${exp.status}

Return ONLY valid JSON:
{"significance": "<high|medium|low>", "winner": "<control|test|inconclusive>", "recommendation": "<clear action recommendation in 2 sentences>", "confidence_pct": <number 0-99>, "next_steps": ["step1","step2","step3"]}`;

    let analysis = {
      significance: 'low', winner: 'inconclusive', confidence_pct: 0,
      recommendation: 'Not enough data to determine statistical significance. Continue the experiment to collect more data.',
      next_steps: ['Continue collecting data', 'Review experiment setup', 'Check for biases'],
    };

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
        if (match) { analysis = { ...analysis, ...JSON.parse(match[0]) }; }
      }
    } catch { /* fallback */ }

    return Response.json({
      experiment_id: exp.id, control_rate: `${controlRate}%`, test_rate: `${testRate}%`,
      uplift: `${uplift}%`, ...analysis,
    });
  } finally { client.release(); }
}
