export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const b = await req.json().catch(() => null);
  if (!b || !b.trigger_event || !b.offer) return Response.json({ error: 'trigger_event and offer required' }, { status: 400 });

  const prompt = `You are an expert B2B sales strategist specializing in upselling existing clients. Write a personalized, consultative upsell script.

Context:
- Trigger event: ${b.trigger_event}
- Offer/Product: ${b.offer}
- Client name: ${b.client_name || 'the client'}
- Client context: ${b.client_context || 'an existing enterprise client'}

Write a natural, conversational upsell script that:
1. Opens with an empathetic reference to the trigger event
2. Bridges to a clear business benefit (not just features)
3. Makes the ask feel logical, not salesy
4. Ends with a low-friction next step

Return ONLY valid JSON:
{"script": "<the full upsell script, 3-4 paragraphs>", "opening_line": "<strong first sentence>", "closing_cta": "<specific ask e.g. 30-min call>"}`;

  let result = {
    script: `[AI unavailable] Standard upsell approach: Reference the trigger event (${b.trigger_event}), position the offer (${b.offer}) as a natural next step, and propose a 30-minute discovery call.`,
    opening_line: `I wanted to reach out about ${b.trigger_event}.`,
    closing_cta: 'Would a 30-minute call this week work?',
  };

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
      if (match) { result = { ...result, ...JSON.parse(match[0]) }; }
    }
  } catch { /* fallback */ }

  const pool = getPool(); const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO consulting_upsell_playbooks (trigger_event,offer,script,success_rate) VALUES ($1,$2,$3,0) RETURNING *`,
      [b.trigger_event, b.offer, result.script]
    );
    return Response.json({ playbook: rows[0], opening_line: result.opening_line, closing_cta: result.closing_cta }, { status: 201 });
  } finally { client.release(); }
}
