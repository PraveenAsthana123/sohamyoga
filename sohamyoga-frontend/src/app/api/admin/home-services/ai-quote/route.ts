import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  try { await requireAdmin(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { service_type, address, bedrooms, bathrooms, sqft, extras } = await req.json();

  const prompt = `Generate a professional home cleaning quote for: ${service_type} at ${address}, ${bedrooms} bed ${bathrooms} bath, ${sqft} sq ft. Extras: ${extras ?? 'none'}. Include: scope of work, estimated time, price breakdown (base + add-ons), what's included/excluded, our guarantee, and cancellation policy. Calgary Alberta market rates.`;

  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json();
    return Response.json({ result: data.response, ai: true });
  } catch {
    const basePrice = service_type === 'deep_clean' ? 280 : service_type === 'move_in' || service_type === 'move_out' ? 350 : service_type === 'post_construction' ? 450 : 180;
    const bedAdj = (parseInt(bedrooms ?? 2) - 2) * 25;
    const bathAdj = (parseInt(bathrooms ?? 1) - 1) * 20;
    const total = basePrice + bedAdj + bathAdj;
    const fallback = `CLEANING QUOTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Service: ${service_type?.replace(/_/g,' ').toUpperCase()}
Property: ${address}
Size: ${bedrooms} bed / ${bathrooms} bath / ${sqft ?? 'N/A'} sq ft

PRICE BREAKDOWN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Base rate (${service_type}):      $${basePrice}.00
Additional bedrooms:         $${Math.max(0, bedAdj)}.00
Additional bathrooms:        $${Math.max(0, bathAdj)}.00
Extras (${extras ?? 'none'}):     TBD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESTIMATED TOTAL:             $${total}.00 + GST

ESTIMATED TIME: ${service_type === 'deep_clean' ? '4-5' : service_type === 'move_out' ? '5-6' : '2-3'} hours

WHAT'S INCLUDED
• All labour and standard cleaning supplies
• Kitchen (appliance exteriors, surfaces, sink)
• Bathrooms (toilet, tub/shower, sink, mirror)
• Bedrooms (dust, vacuum/mop, make beds if linens provided)
• Living areas (dust, vacuum/mop, wipe surfaces)

WHAT'S NOT INCLUDED
• Interior of fridge/oven (add-on: $45 each)
• Windows interior (add-on: $8/window)
• Laundry (add-on: $35/load)
• Garage cleaning

OUR GUARANTEE: 100% satisfaction — we re-clean any missed area within 24h at no charge.

CANCELLATION: 48h notice required; <24h notice = 50% cancellation fee.

⚠️ AI quote unavailable — this is a standard rate estimate. Final price may vary after on-site assessment.`;
    return Response.json({ result: fallback, ai: false });
  }
}
