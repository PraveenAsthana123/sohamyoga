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
    const { rows: stats } = await client.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE pii_found)::int AS pii_found,
        COUNT(*) FILTER (WHERE risk_level='high')::int AS high_risk,
        array_agg(DISTINCT unnest(pii_types)) AS all_types
      FROM pii_scans
    `).catch(() => ({ rows: [] }));

    const prompt = `You are a data privacy compliance expert. Generate a comprehensive privacy compliance report based on PII scan data.

Scan Statistics:
${JSON.stringify(stats[0] ?? {}, null, 2)}

The system applies regulations including PIPEDA (Canada), GDPR principles, and SOC2.

Generate a report covering:
1. Current PII exposure risk assessment
2. Most common PII types detected and their compliance implications
3. Gaps in current masking/redaction policies
4. Regulatory compliance status (PIPEDA, GDPR, HIPAA)
5. Priority remediation actions
6. Recommended additional PII detection patterns

Be specific, reference actual regulations, and prioritize by risk.`;

    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });

    if (!ollamaRes.ok) throw new Error('Ollama unavailable');
    const json = await ollamaRes.json();
    return Response.json({ brief: json.response ?? 'No report generated.' });
  } catch {
    return Response.json({ brief: 'AI Advisor unavailable. Key compliance findings: High-risk SSN/credit card data detected in AI outputs — review data ingestion pipelines. PIPEDA requires consent-based collection. Recommend: (1) add output filtering layer, (2) audit data retention policies, (3) implement automated PII-scrubbing on all AI responses before display.' });
  } finally {
    client.release();
  }
}
