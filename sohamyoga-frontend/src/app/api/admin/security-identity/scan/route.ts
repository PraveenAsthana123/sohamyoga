import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    // Pick 10 random controls to simulate a scan
    const { rows: allControls } = await client.query(
      `SELECT * FROM security_controls_registry ORDER BY RANDOM() LIMIT 10`
    );
    const findings: Record<string, unknown>[] = [];
    let critical = 0, high = 0, medium = 0, passed = 0;
    for (const ctrl of allControls) {
      if (ctrl.implementation_status === 'implemented') {
        passed++;
        findings.push({ control_id: ctrl.control_id, name: ctrl.name, result: 'PASS', severity: null });
      } else if (ctrl.implementation_status === 'partial') {
        if (ctrl.priority === 'critical') { critical++; }
        else { high++; }
        findings.push({ control_id: ctrl.control_id, name: ctrl.name, result: 'PARTIAL', severity: ctrl.priority === 'critical' ? 'critical' : 'high', risk: ctrl.risk_if_missing });
      } else {
        if (ctrl.priority === 'critical') { critical++; }
        else if (ctrl.priority === 'high') { high++; }
        else { medium++; }
        findings.push({ control_id: ctrl.control_id, name: ctrl.name, result: 'MISSING', severity: ctrl.priority, risk: ctrl.risk_if_missing });
      }
    }

    // Ollama: analyze gaps
    let aiAnalysis = 'AI analysis unavailable.';
    try {
      const gapList = findings.filter(f => f.result !== 'PASS').map(f => `${f.control_id}: ${f.name} (${f.severity})`).join('\n');
      const prompt = `You are a security engineer. The following security controls have gaps:\n${gapList}\n\nProvide a concise prioritized remediation plan with top 5 actions. Be specific.`;
      const ollamaRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (ollamaRes.ok) {
        const data = await ollamaRes.json();
        aiAnalysis = data.response ?? aiAnalysis;
      }
    } catch { /* fallback */ }

    const { rows: saved } = await client.query(
      `INSERT INTO security_scans (scan_type, target, findings, critical_count, high_count, medium_count, passed_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      ['automated', 'security_controls_registry', JSON.stringify({ findings, aiAnalysis }), critical, high, medium, passed]
    );
    return Response.json({ scan: saved[0], findings, aiAnalysis });
  } finally {
    client.release();
  }
}
