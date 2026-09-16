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
    const r = await client.query('SELECT * FROM third_party_risks WHERE id=$1', [params.id]);
    if (!r.rowCount) return Response.json({ error: 'Not found' }, { status: 404 });
    const vendor = r.rows[0];
    const dataShared = Array.isArray(vendor.data_shared) ? vendor.data_shared : [];

    const prompt = `You are a third-party risk assessment expert. Conduct a vendor due diligence assessment for:

Vendor: ${vendor.vendor_name}
Service: ${vendor.service || 'General services'}
Data Shared: ${dataShared.join(', ') || 'Not specified'}
Criticality: ${vendor.criticality}
Current Risk Level: ${vendor.risk_level}
Known Findings: ${Array.isArray(vendor.findings) ? vendor.findings.join('; ') : 'None documented'}
Last Assessment: ${vendor.last_assessment || 'Never'}

Provide a structured due diligence assessment:
1. Risk Score (1-10): overall vendor risk with justification
2. Data Risk Assessment: risks specific to data types shared
3. Security Posture Questions: 5 key questions to ask the vendor
4. Compliance Requirements: relevant frameworks (SOC2, ISO27001, GDPR, PCI-DSS, etc.)
5. Contractual Safeguards: key clauses to include in vendor agreements
6. Monitoring Plan: how to monitor ongoing vendor risk
7. Red Flags: warning signs that would require immediate action
8. Recommended Risk Level: (low/medium/high/critical) based on assessment

Be thorough and specific to this vendor type.`;

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
      assessment = `[AI Unavailable] Third-Party Assessment: ${vendor.vendor_name}\n\nRisk Score: 6/10\nData Risk: ${dataShared.length > 0 ? 'Elevated — sensitive data shared' : 'Low — no sensitive data shared'}\nKey Questions:\n1. Do you hold SOC2 Type II certification?\n2. How is our data encrypted at rest and in transit?\n3. Who has access to our data within your organization?\n4. What is your incident notification SLA?\n5. Do you use sub-processors? If so, who?\n\nRecommended: Annual assessment, quarterly check-ins for critical vendors`;
    }
    return Response.json({ assessment, vendor });
  } finally { client.release(); }
}
