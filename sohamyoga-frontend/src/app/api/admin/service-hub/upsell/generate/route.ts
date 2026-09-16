export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { customer_name, service_history, budget_range } = await req.json();

  const prompt = `You are a wellness business upsell specialist. Generate personalized upsell and cross-sell recommendations for:
Customer: ${customer_name}
Service history: ${service_history}
Budget range: ${budget_range}

Return JSON:
{
  "upsell": { "offer": "...", "rationale": "...", "discount": 15, "urgency": "..." },
  "cross_sell": [
    { "service": "...", "reason": "...", "price_hint": "$..." },
    { "service": "...", "reason": "...", "price_hint": "$..." }
  ],
  "personalized_message": "personal message to send to customer",
  "best_timing": "when to make the offer"
}`;

  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json() as { response?: string };
    let parsed: Record<string, unknown> = {};
    try {
      const match = (data.response || '').match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    } catch { /* fallback */ }
    return Response.json(parsed.upsell ? parsed : {
      upsell: { offer: 'Upgrade to Annual Unlimited Membership', rationale: `Based on ${service_history}, customer is ready for a commitment`, discount: 15, urgency: 'Offer expires end of month' },
      cross_sell: [
        { service: 'Weekend Yoga Retreat', reason: 'Great complement to regular classes', price_hint: '$299' },
        { service: 'Private 1-on-1 Session', reason: 'Personalized coaching accelerates progress', price_hint: '$95' },
      ],
      personalized_message: `Hi ${customer_name}! Based on your amazing progress, we have a special offer just for you...`,
      best_timing: 'After completing 5th class or 3 weeks in',
      ai_generated: false,
    });
  } catch {
    return Response.json({ error: 'AI unavailable' }, { status: 503 });
  }
}
