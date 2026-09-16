import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { year, make, model, trim, km, condition } = body;
    if (!year || !make || !model) return Response.json({ error: 'year, make, model required' }, { status: 400 });

    const prompt = `You are an expert Canadian automotive appraiser specializing in the Alberta market (Calgary/Edmonton). Provide a trade-in value estimate for:

Vehicle: ${year} ${make} ${model} ${trim || ''}
Mileage: ${km ? `${Number(km).toLocaleString()} km` : 'Unknown'}
Condition: ${condition || 'Good'}
Market: Alberta, Canada

Provide:
1. Low trade-in value (CAD)
2. Average trade-in value (CAD)
3. High trade-in value (CAD)
4. Key factors affecting value (bullet points)
5. Current market notes for this vehicle in Alberta

Be specific with dollar amounts. Consider Canadian market pricing, Alberta fuel preferences (trucks/SUVs popular), current used car market conditions, and deduct appropriately for high km or poor condition.`;

    let appraisal = '';
    try {
      const ollamaRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (ollamaRes.ok) {
        const data = await ollamaRes.json();
        appraisal = data.response ?? '';
      }
    } catch {
      // Graceful fallback
    }

    if (!appraisal) {
      const baseValue = 25000;
      const kmDeduction = Math.max(0, (parseInt(String(km)) - 20000) * 0.08);
      const low = Math.round((baseValue - kmDeduction) * 0.85 / 100) * 100;
      const avg = Math.round((baseValue - kmDeduction) / 100) * 100;
      const high = Math.round((baseValue - kmDeduction) * 1.10 / 100) * 100;
      appraisal = `Trade-In Estimate for ${year} ${make} ${model} ${trim || ''} in Alberta:\n\n• Low: $${low.toLocaleString('en-CA')}\n• Average: $${avg.toLocaleString('en-CA')}\n• High: $${high.toLocaleString('en-CA')}\n\nKey Factors:\n• Mileage: ${km ? Number(km).toLocaleString() + ' km' : 'unknown'}\n• Condition: ${condition || 'Good'}\n• Alberta market conditions apply\n\nNote: AI service offline. Values are estimates only — verify with live market data (AutoTrader, Canadian Black Book).`;
    }

    return Response.json({ appraisal, vehicle: { year, make, model, trim, km, condition } });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
