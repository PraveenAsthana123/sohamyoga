import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const body = await req.json();
  const { customer_name, address, visit_date, visit_type, technician_name, ph_level, chlorine_ppm, alkalinity_ppm, calcium_hardness, notes, labour_hours, total_amount, pool_type } = body;

  const prompt = `Generate a professional pool service report for a Canadian client. Use a formal but friendly tone.

Service Details:
- Customer: ${customer_name}
- Address: ${address}
- Date: ${visit_date}
- Service Type: ${visit_type}
- Technician: ${technician_name}
- Pool Type: ${pool_type}

Water Chemistry Readings:
- pH: ${ph_level}
- Free Chlorine: ${chlorine_ppm} ppm
- Total Alkalinity: ${alkalinity_ppm} ppm
- Calcium Hardness: ${calcium_hardness} ppm

Technician Notes: ${notes || 'None'}
Labour Hours: ${labour_hours}
Total Amount: $${total_amount} CAD

Write a complete service report including: summary of work performed, water chemistry assessment (note any out-of-range values), recommendations for next service, and any action items for the customer. Format as a professional document ready to send to the client.`;

  try {
    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!ollamaRes.ok) throw new Error('Ollama error');
    const data = await ollamaRes.json();
    return Response.json({ report: data.response });
  } catch {
    const fallback = `POOL SERVICE REPORT
Date: ${visit_date} | Customer: ${customer_name} | ${address}
Technician: ${technician_name} | Service: ${visit_type}

WATER CHEMISTRY:
pH: ${ph_level} ${ph_level >= 7.2 && ph_level <= 7.8 ? '✓' : '⚠ Adjusted'} | Chlorine: ${chlorine_ppm} ppm ${chlorine_ppm >= 1 && chlorine_ppm <= 3 ? '✓' : '⚠ Adjusted'} | Alkalinity: ${alkalinity_ppm} ppm | Calcium Hardness: ${calcium_hardness} ppm

WORK PERFORMED: ${notes || 'Routine maintenance service completed.'}

NEXT SERVICE: Recommended in 2 weeks for chemical check. Schedule seasonal closing in September.

Total: $${total_amount} CAD | Thank you for choosing our pool services.`;
    return Response.json({ report: fallback, offline: true });
  }
}
