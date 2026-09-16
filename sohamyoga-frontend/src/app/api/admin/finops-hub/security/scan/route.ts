export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows: controls } = await client.query('SELECT * FROM security_controls');
    const summary = controls.map(c => `${c.control_name}: ${c.status}`).join('\n');
    const compliant = controls.filter(c => c.status === 'compliant').length;
    const total = controls.length;

    const prompt = `You are a cybersecurity specialist. Assess this security posture:
${summary}

Return JSON:
{
  "overall_score": 78,
  "risk_level": "medium",
  "critical_gaps": ["gap1", "gap2"],
  "quick_wins": ["action1", "action2"],
  "compliance_status": "PIPEDA: partial, SOC2: not assessed",
  "recommendation": "priority action to take this week"
}`;

    let assessment: Record<string, unknown> = {};
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json() as { response?: string };
      const match = (data.response || '').match(/\{[\s\S]*\}/);
      if (match) assessment = JSON.parse(match[0]);
    } catch { /* fallback */ }

    const score = Math.round((compliant / Math.max(total, 1)) * 100);
    return Response.json(assessment.overall_score ? assessment : {
      overall_score: score,
      risk_level: score >= 80 ? 'low' : score >= 60 ? 'medium' : 'high',
      critical_gaps: controls.filter(c => c.status === 'non_compliant').map(c => c.control_name),
      quick_wins: controls.filter(c => c.status === 'partial').map(c => `Complete: ${c.control_name}`),
      compliance_status: 'PIPEDA: partial (data retention policy gap), SOC2: not yet assessed',
      recommendation: 'Implement automated data retention deletion to close PIPEDA compliance gap this sprint',
      compliant_count: compliant,
      total_controls: total,
      ai_generated: false,
    });
  } finally { client.release(); }
}
