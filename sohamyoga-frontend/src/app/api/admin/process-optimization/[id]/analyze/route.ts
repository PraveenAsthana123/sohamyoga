export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const r = await client.query('SELECT * FROM optimization_initiatives WHERE id=$1', [params.id]);
    if (!r.rowCount) return Response.json({ error: 'Not found' }, { status: 404 });
    const init = r.rows[0];
    const prompt = `You are a Six Sigma / Lean process improvement expert. Perform a DMAIC analysis for the following improvement initiative:

Initiative: ${init.name}
Methodology: ${init.methodology}
Process: ${init.process_name || 'General business process'}
Current Performance: ${init.current_metric} ${init.unit || ''}
Target Performance: ${init.target_metric} ${init.unit || ''}
Current Stage: ${init.status}
Owner: ${init.owner || 'TBD'}

Provide a structured DMAIC analysis with:
1. Define: Problem statement and project charter summary
2. Measure: Key metrics and baseline data needed
3. Analyze: Top 3 root causes (use fishbone/5-why thinking)
4. Improve: Top 3 improvement solutions
5. Control: Control plan and monitoring approach
6. ROI Estimate: Expected savings justification

Be specific and actionable. Format clearly with headings.`;

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
      analysis = `[AI Unavailable] DMAIC Analysis for ${init.name}:\n\nDefine: Reduce ${init.process_name} from ${init.current_metric} to ${init.target_metric} ${init.unit}\nMeasure: Collect baseline data on cycle times, error rates, and costs\nAnalyze: Root causes - manual handoffs, unclear ownership, missing SLAs\nImprove: Automate handoffs, assign clear owners, set SLAs with escalation\nControl: Weekly dashboard review, automated alerts on threshold breach\nROI: Estimated $${init.savings_usd?.toLocaleString() || '0'} annual savings`;
    }
    return Response.json({ analysis, initiative: init });
  } finally { client.release(); }
}
