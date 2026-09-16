import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const body = await req.json();
  const { ph, chlorine_ppm, alkalinity_ppm, calcium_hardness, pool_size_gallons, pool_type } = body;

  const prompt = `You are a certified pool water chemistry specialist for a Canadian pool service company operating in Alberta.

Current water readings:
- pH: ${ph ?? 'not provided'}
- Free Chlorine: ${chlorine_ppm ?? 'not provided'} ppm
- Total Alkalinity: ${alkalinity_ppm ?? 'not provided'} ppm
- Calcium Hardness: ${calcium_hardness ?? 'not provided'} ppm
- Pool Size: ${pool_size_gallons ?? 'not provided'} gallons
- Pool Type: ${pool_type ?? 'inground'}

Alberta context: outdoor pools deal with UV intensity, temperature swings from spring to summer, and ALGC chemical handling compliance.

Provide specific chemical dosage recommendations to bring the water into ideal balance (pH 7.2–7.8, chlorine 1–3 ppm, alkalinity 80–120 ppm, calcium hardness 200–400 ppm). Include:
1. Priority issues identified
2. Chemical additions needed (product name, amount to add)
3. Order of addition (important: never add multiple chemicals at once)
4. Wait time between additions
5. Re-test timing

Keep response practical and concise for a technician in the field.`;

  try {
    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!ollamaRes.ok) throw new Error('Ollama error');
    const data = await ollamaRes.json();
    return Response.json({ recommendation: data.response });
  } catch {
    const fallback = `WATER CHEMISTRY ASSESSMENT (offline fallback):

Current readings indicate ${ph < 7.2 ? 'LOW pH — add sodium carbonate (soda ash)' : ph > 7.8 ? 'HIGH pH — add muriatic acid or sodium bisulfate' : 'pH in range (7.2–7.8)'}
${chlorine_ppm < 1 ? 'LOW chlorine — add chlorine shock (calcium hypochlorite)' : chlorine_ppm > 3 ? 'HIGH chlorine — allow natural dissipation, reduce sun cover' : 'Chlorine in range (1–3 ppm)'}
${alkalinity_ppm < 80 ? 'LOW alkalinity — add sodium bicarbonate (baking soda)' : alkalinity_ppm > 120 ? 'HIGH alkalinity — add muriatic acid slowly' : 'Alkalinity in range (80–120 ppm)'}

ALGC Compliance Note: Ensure all chemicals are Health Canada registered. Never mix chemicals — add one at a time with pump running, wait 15–30 min between additions. Re-test in 4 hours.`;
    return Response.json({ recommendation: fallback, offline: true });
  }
}
