export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body?.process_type) return Response.json({ error: 'process_type required' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const metrics = await client.query(`
      SELECT current_stage, COUNT(*) as count, AVG(EXTRACT(EPOCH FROM (NOW()-started_at))/3600)::NUMERIC(10,1) as avg_hours
      FROM enterprise_process_instances WHERE process_type=$1 GROUP BY current_stage
    `, [body.process_type]);

    const prompt = `You are an enterprise process improvement expert. Analyze the following ${body.process_type} process data:

Stage Distribution (current active instances by stage):
${metrics.rows.map(r => `- ${r.current_stage}: ${r.count} instances, avg ${r.avg_hours} hours`).join('\n')}

Provide:
1. Bottleneck Identification: which stages have the most instances stuck?
2. Cycle Time Analysis: where is time being lost?
3. Top 3 Improvement Opportunities with estimated impact
4. Technology Recommendations: what tools/automation could help?
5. KPI Targets: suggested SLA per stage

Be specific to the ${body.process_type} process context.`;

    let analysis = '';
    try {
      const aiRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        analysis = aiData.response || '';
      }
    } catch {
      analysis = `[AI Unavailable] ${body.process_type} Analysis:\n\nBottleneck: Most instances appear stuck in middle stages\nRecommendation: Review approval handoffs, automate status notifications, set stage-level SLAs\nKPI Targets: Each stage should complete in <24 hours for standard volume`;
    }
    return Response.json({ analysis, metrics: metrics.rows, process_type: body.process_type });
  } finally { client.release(); }
}
