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
    const { rows } = await client.query('SELECT * FROM conversion_offers WHERE id=$1', [params.id]);
    if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    const offer = rows[0];

    const prompt = `You are a world-class conversion copywriter. Optimize this offer's headline and CTA for maximum conversion.

Current offer:
- Name: ${offer.name}
- Type: ${offer.type}
- Headline: ${offer.headline || 'not set'}
- CTA: ${offer.cta || 'not set'}
- Discount: ${offer.discount_pct}%
- Current conversions: ${offer.conversions}

Return ONLY valid JSON with 3 variants:
{"variants": [
  {"headline": "<headline 1>", "cta": "<cta 1>", "rationale": "<why this works>"},
  {"headline": "<headline 2>", "cta": "<cta 2>", "rationale": "<why this works>"},
  {"headline": "<headline 3>", "cta": "<cta 3>", "rationale": "<why this works>"}
]}`;

    let variants = [
      { headline: `${offer.discount_pct > 0 ? `Save ${offer.discount_pct}%: ` : ''}${offer.headline || offer.name}`, cta: offer.cta || 'Get Started Now', rationale: 'Original — no AI optimization available' },
    ];

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
        if (match) { const parsed = JSON.parse(match[0]); variants = parsed.variants || variants; }
      }
    } catch { /* use fallback */ }

    return Response.json({ offer_id: offer.id, offer_name: offer.name, variants });
  } finally { client.release(); }
}
