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
    const r = await client.query('SELECT * FROM risk_register WHERE id=$1', [params.id]);
    if (!r.rowCount) return Response.json({ error: 'Not found' }, { status: 404 });
    const risk = r.rows[0];
    const score = risk.risk_score || (risk.likelihood * risk.impact);
    const severity = score >= 20 ? 'Critical' : score >= 12 ? 'High' : score >= 6 ? 'Medium' : 'Low';

    const prompt = `You are an enterprise risk management expert. Assess the following risk and provide actionable guidance:

Risk Title: ${risk.title}
Category: ${risk.category}
Description: ${risk.description}
Likelihood: ${risk.likelihood}/5
Impact: ${risk.impact}/5
Risk Score: ${score}/25 (${severity})
Current Controls: ${(risk.controls || []).join(', ') || 'None documented'}
Current Treatment: ${risk.treatment}
Status: ${risk.status}

Provide a structured risk assessment with:
1. Risk Assessment Summary: confirm severity classification and rationale
2. Control Effectiveness: evaluate current controls (1-5 each), identify gaps
3. Additional Controls Recommended: top 3 specific, implementable controls
4. Treatment Options: evaluate Mitigate/Transfer/Accept/Avoid with pros/cons
5. Residual Risk: estimated risk score after recommended controls
6. Immediate Actions: what to do in the next 30 days
7. Key Risk Indicators: 2-3 measurable KRIs to monitor this risk

Be specific and quantify where possible.`;

    let assessment = '';
    try {
      const aiRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        assessment = aiData.response || '';
      }
    } catch {
      assessment = `[AI Unavailable] Risk Assessment: ${risk.title}\n\nSeverity: ${severity} (Score: ${score}/25)\n\nControl Gaps: Review existing controls for completeness\nRecommended Controls:\n1. Implement automated monitoring alerts\n2. Conduct quarterly control testing\n3. Establish escalation procedures\n\nResidual Risk Estimate: Score reduced to ${Math.max(1, score - 4)} after controls\n\nImmediate Actions:\n1. Review and update control documentation\n2. Assign risk owner and set review date\n3. Assess control operating effectiveness`;
    }
    return Response.json({ assessment, risk, severity, score });
  } finally { client.release(); }
}
