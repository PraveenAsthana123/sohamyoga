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
    const { rows } = await client.query(`SELECT * FROM ai_vendors WHERE id=$1`, [params.id]);
    if (rows.length === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    const vendor = rows[0];

    const prompt = `You are an AI vendor assessment specialist. Score this vendor across 5 dimensions (0-100 each):

Vendor: ${vendor.name}
Category: ${vendor.category}
Capabilities: ${(vendor.capabilities ?? []).join(', ')}
Pricing: ${vendor.pricing_model}
Data Residency: ${(vendor.data_residency ?? []).join(', ')}
Compliance: ${(vendor.compliance ?? []).join(', ')}

Score these dimensions:
1. Security (data encryption, access controls, audit logs)
2. Compliance (GDPR, HIPAA, SOC2 coverage)
3. Cost (pricing model value vs competitors)
4. Capability (breadth and quality of AI features)
5. Support (documentation, SLA, enterprise support)

Respond as JSON: {"security":N,"compliance":N,"cost":N,"capability":N,"support":N,"overall":N,"summary":"one sentence","recommendation":"approve|evaluate|reject"}`;

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
      const scorecard = match ? JSON.parse(match[0]) : null;
      if (scorecard?.overall) {
        await client.query(`UPDATE ai_vendors SET score=$1 WHERE id=$2`, [scorecard.overall, params.id]);
      }
      return Response.json({ vendor: vendor.name, scorecard, raw: text });
    } catch {
      const fallback = { security: 82, compliance: 78, cost: 85, capability: 80, support: 75, overall: 80, summary: 'Ollama unavailable — static scorecard', recommendation: 'evaluate' };
      return Response.json({ vendor: vendor.name, scorecard: fallback });
    }
  } finally {
    client.release();
  }
}
