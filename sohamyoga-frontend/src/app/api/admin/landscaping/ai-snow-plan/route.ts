import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  try {
    const body = await req.json();
    const { property_type, lot_size_sqft } = body;
    const prompt = `Create an Alberta winter snow removal plan for ${property_type} with ${lot_size_sqft} sq ft. Include: trigger depth (Calgary avg 12cm per event), typical service priority, salt/sand application rates, ice management protocol, equipment used, response time SLA, City of Calgary sidewalk bylaw compliance (24hr after snowfall end), and seasonal pricing. Professional contract language.`;
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error('Ollama unavailable');
    const data = await res.json();
    return NextResponse.json({ plan: data.response });
  } catch {
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({ plan: `ALBERTA SNOW REMOVAL PLAN\n\nProperty: ${body.property_type ?? 'N/A'} · ${body.lot_size_sqft ?? 'N/A'} sq ft\n\nTrigger Depth: 5cm residential / 2cm commercial\nResponse Time: 4hr residential / 2hr commercial\nSidewalk Bylaw: City of Calgary — cleared within 24hr of snowfall end\nApplication: Sand/salt blend at 15g/m²\n\n[AI generation unavailable — complete manually per Calgary winter service standards]` });
  }
}
