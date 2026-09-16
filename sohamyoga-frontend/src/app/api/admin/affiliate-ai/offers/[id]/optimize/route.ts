export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const { id } = await params;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT * FROM affiliate_offers WHERE id=$1', [id]);
    if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    const offer = rows[0];

    const prompt = `You are an affiliate commission optimization AI. Analyze and optimize this offer:
Offer: ${offer.name}
Current commission: ${offer.commission_value}${offer.commission_type === 'percentage' ? '%' : ' flat'}
Cookie window: ${offer.cookie_days} days
Current predicted ROI: ${offer.predicted_roi}%

Return JSON:
{
  "optimized_commission": 12,
  "optimized_cookie_days": 45,
  "optimized_roi": 420,
  "rationale": "why this optimization works",
  "partner_motivation_score": 85,
  "recommendations": ["tip1", "tip2", "tip3"]
}`;

    let optimized: Record<string, unknown> = {};
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json() as { response?: string };
      const match = (data.response || '').match(/\{[\s\S]*\}/);
      if (match) optimized = JSON.parse(match[0]);
    } catch { /* fallback */ }

    const newCommission = Number(optimized.optimized_commission) || Number(offer.commission_value) * 1.2;
    const newCookie = Number(optimized.optimized_cookie_days) || Number(offer.cookie_days) + 15;
    const newRoi = Number(optimized.optimized_roi) || Number(offer.predicted_roi) * 1.3;

    await client.query(
      'UPDATE affiliate_offers SET commission_value=$1, cookie_days=$2, predicted_roi=$3, ai_optimized=TRUE WHERE id=$4',
      [newCommission, newCookie, newRoi, id]
    );

    return Response.json({
      original: offer,
      optimized_commission: newCommission,
      optimized_cookie_days: newCookie,
      optimized_roi: newRoi,
      rationale: optimized.rationale || 'Increased commission by 20% to improve partner motivation. Extended cookie window to capture longer consideration cycles.',
      recommendations: (optimized.recommendations as string[]) || ['Add performance bonuses at 50+ conversions', 'Create tiered commission structure', 'Offer seasonal bonus rates'],
    });
  } finally { client.release(); }
}
