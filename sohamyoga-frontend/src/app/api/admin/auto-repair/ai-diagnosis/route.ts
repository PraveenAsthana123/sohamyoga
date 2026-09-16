import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const { year, make, model, odometer_km, fuel_type, customer_concern, inspection_notes } = body;
  if (!year || !make || !model || !customer_concern) return Response.json({ error: 'year, make, model, customer_concern required' }, { status: 400 });

  const prompt = `Provide a diagnostic assessment for vehicle: ${year} ${make} ${model}, ${odometer_km ?? 'unknown'}km, ${fuel_type ?? 'gasoline'}.
Customer concern: ${customer_concern}.
${inspection_notes ? `Inspection notes: ${inspection_notes}.` : ''}
Include:
1. Possible causes (most to least likely)
2. Diagnostic tests to perform
3. Estimated parts and labour for top 3 causes (Canadian prices in CAD)
4. Maintenance items due based on mileage
5. Customer communication talking points
Use professional auto service advisor language. Format clearly with numbered sections.`;

  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = await res.json() as { response?: string };
    return Response.json({ diagnosis: data.response || '', ai_generated: true });
  } catch {
    return Response.json({
      diagnosis: `Diagnostic Assessment — ${year} ${make} ${model}\n\nCustomer Concern: ${customer_concern}\n\nPossible Causes:\n1. Most likely: Component wear consistent with ${odometer_km ?? 'high'} km\n2. Secondary: Deferred maintenance items\n3. Less likely: Wiring or sensor issue\n\nRecommended Tests:\n• Visual inspection\n• OBD-II diagnostic scan\n• Road test under varied conditions\n\nEstimated Cost Range (CAD):\n• Minor repair: $150–$350\n• Moderate repair: $400–$900\n• Major repair: $1,000+\n\n(AI service temporarily unavailable — using standard assessment template)`,
      ai_generated: false,
      fallback: true,
    });
  }
}
