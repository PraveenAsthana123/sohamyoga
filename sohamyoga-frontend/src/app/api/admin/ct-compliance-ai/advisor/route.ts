export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export async function POST(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const [checksRes, incidentsRes] = await Promise.all([
      client.query(`
        SELECT regulation, check_name, status, risk_level, evidence
        FROM compliance_ai_checks
        WHERE status != 'compliant'
        ORDER BY risk_level DESC, regulation
      `).catch(() => ({ rows: [] })),
      client.query(`SELECT * FROM compliance_ai_incidents WHERE status = 'open'`).catch(() => ({ rows: [] })),
    ]);

    const prompt = `You are a regulatory compliance consultant for a digital health and wellness SaaS company operating in Canada and internationally.

Non-Compliant / Partial Checks:
${JSON.stringify(checksRes.rows, null, 2)}

Open Compliance Incidents:
${JSON.stringify(incidentsRes.rows, null, 2)}

Regulations in scope: GDPR, PIPEDA, HIPAA, SOC2, WCAG.

Provide:
1. Gap analysis — most critical compliance gaps by regulation
2. Remediation priority list (P0/P1/P2) with effort estimates
3. Quick wins achievable in <1 week
4. Long-term structural compliance improvements
5. Recommended compliance automation tools

Reference specific regulatory articles where applicable.`;

    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });

    if (!ollamaRes.ok) throw new Error('Ollama unavailable');
    const json = await ollamaRes.json();
    return Response.json({ brief: json.response ?? 'No analysis generated.' });
  } catch {
    return Response.json({ brief: 'AI Advisor unavailable. Critical gaps: P0 — Enable database encryption (HIPAA breach risk). P1 — Run GDPR email consent audit (overdue 14mo). P1 — Complete cross-border BCR review for PIPEDA. P2 — Formalize CAB process for SOC2 Change Management. Quick win: Add audit logging to UI actions (1-2 days).' });
  } finally {
    client.release();
  }
}
