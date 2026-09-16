import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  try {
    const body = await req.json();
    const { service_types, property_type, lot_size_sqft, frequency } = body;
    const prompt = `Generate a landscaping quote for: ${service_types?.join(', ')} at ${property_type} property, ${lot_size_sqft} sq ft. Location: Calgary, Alberta. Frequency: ${frequency}. Include: scope of work per service, season-specific details (Alberta climate: snow April/Oct, hot dry summers), price breakdown, annual package value, what's included/excluded, and a professional proposal paragraph. Calgary market rates.`;
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error('Ollama unavailable');
    const data = await res.json();
    return NextResponse.json({ quote: data.response });
  } catch {
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({ quote: `LANDSCAPING QUOTE\n\nServices: ${body.service_types?.join(', ') ?? 'N/A'}\nProperty Type: ${body.property_type ?? 'N/A'}\nLot Size: ${body.lot_size_sqft ?? 'N/A'} sq ft\nFrequency: ${body.frequency ?? 'N/A'}\nLocation: Calgary, AB\n\n[AI generation unavailable — please complete quote manually based on Calgary market rates]` });
  }
}
