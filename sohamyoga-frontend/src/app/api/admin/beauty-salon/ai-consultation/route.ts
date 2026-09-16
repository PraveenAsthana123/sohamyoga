import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { skin_type = 'normal', hair_type = 'normal', allergies = 'none', service = 'general treatment', client_name = 'Client' } = body;
    const prompt = `You are a professional beauty consultant at a Canadian salon and spa. Client profile for ${client_name}: Skin type: ${skin_type}, Hair type: ${hair_type}, Known allergies/sensitivities: ${allergies}. Requested service: ${service}. Please provide a professional consultation covering: 1) Pre-appointment preparation advice, 2) What to expect during the service, 3) Post-service aftercare instructions (include product recommendations to use and avoid), 4) Complementary services that would enhance results, 5) Products to recommend for home maintenance, 6) Any contraindications or cautions given the client profile. Format clearly with headers. Use Canadian product availability context.`;
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) {
        const data = await res.json();
        return Response.json({ consultation: data.response, source: 'ollama' });
      }
    } catch { /* fallback */ }
    const fallback = `Beauty Consultation for ${client_name}\n\nService: ${service}\nSkin Type: ${skin_type} | Hair Type: ${hair_type}\nAllergies: ${allergies}\n\n1. Pre-Appointment: Arrive with clean skin/hair; avoid heavy products.\n2. During Service: Communicate comfort and preferences to your stylist.\n3. Aftercare: Follow stylist instructions; avoid heat/chemicals 24-48h post-treatment.\n4. Complementary Services: Ask your stylist for personalized recommendations.\n5. Home Care: Use professional-grade products suited to your type.\n6. Cautions: Notify stylist of any reactions.\n\nNote: AI consultant (Ollama) is offline — connect for personalized advice.`;
    return Response.json({ consultation: fallback, source: 'fallback' });
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
