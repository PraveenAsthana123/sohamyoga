export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { product, partner_niche, format, unique_selling_point } = await req.json();

  const prompt = `You are an affiliate creative copywriter. Generate a high-converting ${format} creative for "${product}" targeting a "${partner_niche}" audience.
Unique selling point: ${unique_selling_point}
Return JSON:
{
  "headline": "attention-grabbing headline (max 60 chars)",
  "body": "persuasive body copy (2-3 sentences)",
  "cta": "strong call-to-action",
  "value_proposition": "key benefit in one line",
  "ctr_prediction": 4.5
}`;

  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json() as { response?: string };
    let parsed: Record<string, unknown> = {};
    try {
      const match = (data.response || '').match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    } catch { /* fallback */ }
    return Response.json({
      headline: parsed.headline || `Transform Your Life with ${product}`,
      body: parsed.body || `Join thousands who discovered the power of ${product}. ${unique_selling_point}. Start your journey today.`,
      cta: parsed.cta || 'Start Free Trial',
      value_proposition: parsed.value_proposition || `The #1 ${product} solution for ${partner_niche} enthusiasts`,
      ctr_prediction: parsed.ctr_prediction || 4.2,
      ai_generated: true,
    });
  } catch {
    return Response.json({
      headline: `Discover ${product} Today`,
      body: `${unique_selling_point}. Perfect for ${partner_niche} enthusiasts. Join our growing community.`,
      cta: 'Learn More',
      value_proposition: `Premium ${product} for ${partner_niche}`,
      ctr_prediction: 3.5,
      ai_generated: false,
      fallback: true,
    });
  }
}
