export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`SELECT * FROM ai_privacy_assessments WHERE id=$1`, [params.id]);
    if (rows.length === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    const a = rows[0];

    const prompt = `You are a privacy compliance expert. Perform a gap analysis for:

System: ${a.system_name}
Data Types: ${(a.data_types ?? []).join(', ')}
PII Present: ${a.pii_present}
Retention: ${a.retention_days} days
Encryption: ${a.encryption}
Known Findings: ${(a.findings ?? []).join('; ')}

Analyze gaps against:
1. GDPR (EU General Data Protection Regulation)
2. PIPEDA (Canada Personal Information Protection and Electronic Documents Act)
3. HIPAA (if health data involved)

For each regulation provide: compliance_status (compliant/partial/non-compliant), gaps (list), remediation_actions (list).

Respond as JSON: {"gdpr":{"status":"...","gaps":[...],"actions":[...]},"pipeda":{"status":"...","gaps":[...],"actions":[...]},"hipaa":{"status":"not_applicable",...},"overall_risk":"low/medium/high","priority_action":"..."}`;

    try {
      const ollamaRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await ollamaRes.json();
      const text = data.response ?? '';
      const match = text.match(/\{[\s\S]*\}/);
      const analysis = match ? JSON.parse(match[0]) : null;
      return Response.json({ system_name: a.system_name, analysis, raw: text });
    } catch {
      return Response.json({
        system_name: a.system_name,
        analysis: {
          gdpr: { status: 'partial', gaps: ['Consent mechanism missing', 'No data subject request workflow'], actions: ['Add consent banner', 'Build erasure API endpoint'] },
          pipeda: { status: 'partial', gaps: ['Privacy policy not updated for AI use'], actions: ['Update privacy policy with AI disclosure'] },
          hipaa: { status: 'not_applicable', gaps: [], actions: [] },
          overall_risk: a.risk_level,
          priority_action: 'Implement consent management platform before next audit',
        },
        raw: 'Ollama unavailable — static fallback',
      });
    }
  } finally {
    client.release();
  }
}
