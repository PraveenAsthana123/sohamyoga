export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { service_name, historical_avg, season, upcoming_promotions } = await req.json();

  const prompt = `You are a demand forecasting specialist for a yoga/wellness studio. Generate a 4-week demand forecast for:
Service: ${service_name}
Historical weekly average: ${historical_avg} bookings
Season: ${season}
Upcoming promotions: ${upcoming_promotions}

Return JSON:
{
  "weeks": [
    { "period": "Week 1", "forecasted_bookings": 25, "confidence_pct": 85, "factors": ["factor1", "factor2"] },
    { "period": "Week 2", "forecasted_bookings": 28, "confidence_pct": 80, "factors": ["factor1"] },
    { "period": "Week 3", "forecasted_bookings": 22, "confidence_pct": 75, "factors": ["factor1"] },
    { "period": "Week 4", "forecasted_bookings": 30, "confidence_pct": 70, "factors": ["factor1", "factor2"] }
  ],
  "trend": "upward|stable|downward",
  "key_insight": "main forecasting insight",
  "staffing_recommendation": "how many instructors needed"
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
    const base = Number(historical_avg) || 20;
    return Response.json(parsed.weeks ? parsed : {
      weeks: [
        { period: 'Week 1', forecasted_bookings: Math.round(base * 1.05), confidence_pct: 82, factors: [season, 'baseline trend'] },
        { period: 'Week 2', forecasted_bookings: Math.round(base * 1.10), confidence_pct: 78, factors: [upcoming_promotions, 'momentum'] },
        { period: 'Week 3', forecasted_bookings: Math.round(base * 0.95), confidence_pct: 74, factors: ['mid-period dip', 'historical pattern'] },
        { period: 'Week 4', forecasted_bookings: Math.round(base * 1.15), confidence_pct: 70, factors: ['end-of-month surge', upcoming_promotions] },
      ],
      trend: 'upward',
      key_insight: `${service_name} demand expected to grow 10-15% over the next 4 weeks driven by ${upcoming_promotions}`,
      staffing_recommendation: `Schedule ${Math.ceil(base * 1.1 / 10)} instructors per session to handle projected demand`,
      ai_generated: false,
    });
  } catch {
    return Response.json({ error: 'AI unavailable' }, { status: 503 });
  }
}
