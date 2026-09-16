export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool(); const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT * FROM lead_management_leads WHERE id=$1', [params.id]);
    if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    const lead = rows[0];
    const prompt = `You are a B2B data enrichment specialist. Enrich this lead's company profile.

Lead:
- Name: ${lead.name}
- Company: ${lead.company || 'unknown'}
- Email domain: ${lead.email ? lead.email.split('@')[1] : 'unknown'}
- Source: ${lead.source || 'unknown'}

Return ONLY valid JSON with these fields:
{"industry": "<industry vertical>", "company_size": "<1-10|10-50|50-200|200-500|500+>", "annual_revenue": "<estimated range>", "pain_points": ["pain1","pain2","pain3"], "technologies": ["tech1","tech2"], "location": "<city, country>", "linkedin": "<linkedin-handle>"}`;

    let enrichment_data = lead.enrichment_data || {};

    try {
      const aiRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const text = aiData.response || '';
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          enrichment_data = { ...enrichment_data, ...parsed, enriched_at: new Date().toISOString() };
        }
      }
    } catch { enrichment_data = { ...enrichment_data, enriched_at: new Date().toISOString(), note: 'AI unavailable — partial enrichment' }; }

    await client.query('UPDATE lead_management_leads SET enrichment_data=$1 WHERE id=$2', [JSON.stringify(enrichment_data), params.id]);
    return Response.json({ enrichment_data });
  } finally { client.release(); }
}
