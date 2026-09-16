import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  try {
    const { resident_name, diagnoses, care_level, assessment_scores, unit } = await req.json();
    if (!diagnoses) return Response.json({ error: 'diagnoses required' }, { status: 400 });
    const prompt = `You are an Alberta-certified care coordinator working in a continuing care facility regulated under the Alberta Continuing Care Health Service Standards (CCHSS). Draft a person-centred individualized care plan for the following resident:

Resident: ${resident_name || 'Unknown'}
Unit: ${unit || 'assisted'}
Care Level: ${care_level || 3} (AHS scale 1–5)
Primary/Secondary Diagnoses: ${Array.isArray(diagnoses) ? diagnoses.join(', ') : diagnoses}
Recent Assessment Scores: ${assessment_scores ? JSON.stringify(assessment_scores) : 'not provided'}

Structure your response as:
1. CARE GOALS (3–5 measurable SMART goals)
2. DAILY ROUTINE & PERSONAL CARE (ADL support plan)
3. SAFETY MEASURES (fall prevention, wandering prevention if applicable)
4. NUTRITION & HYDRATION plan
5. PSYCHOSOCIAL & RECREATIONAL needs
6. FAMILY COMMUNICATION recommendations
7. MEDICATION MANAGEMENT notes
8. AISH/FUNDING considerations (if relevant)
9. PHYSICIAN REVIEW schedule
10. 90-DAY REASSESSMENT triggers

Use professional clinical language aligned with RAI-MDS documentation standards.`;

    let aiText = '';
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) {
        const data = await res.json() as { response?: string };
        aiText = data.response || '';
      }
    } catch {
      // Ollama unavailable — return structured fallback
    }
    if (!aiText) {
      aiText = `INDIVIDUALIZED CARE PLAN — ${resident_name || 'Resident'}\nCare Level ${care_level || 3} | Unit: ${unit || 'assisted'}\n\n` +
        `1. CARE GOALS\n• Maintain current functional mobility with HCA assist for toileting and bathing\n• Prevent falls using bed alarm, non-slip footwear, and hourly rounding\n• Monitor for pain using Abbey Pain Scale daily (target score <3)\n• Engage in 2 scheduled recreational activities per week\n• Facilitate weekly family communication via portal or phone\n\n` +
        `2. DAILY ROUTINE & PERSONAL CARE\n• Morning: bathing/hygiene with HCA support (HOH or full assist per assessment)\n• Dressing: standby assist; adaptive clothing recommended\n• Continence: scheduled toileting Q2H; brief use at night\n\n` +
        `3. SAFETY MEASURES\n• Fall risk: HIGH — bed alarm on, low-rise bed, floor mat\n• Call bell within reach at all times\n• Environmental hazard review monthly\n\n` +
        `4. NUTRITION & HYDRATION\n• Diet texture: regular/minced as per SLP assessment\n• Fluid intake target: 1,500 mL/day; offer fluids hourly\n• Weight monitoring: monthly; notify physician if >5% change\n\n` +
        `5. PSYCHOSOCIAL & RECREATIONAL\n• Spiritual/cultural preferences documented in resident profile\n• Activity preferences: music, reminiscence, gardening program\n• Social interaction: encourage dining room participation\n\n` +
        `6. FAMILY COMMUNICATION\n• Weekly update calls to designated emergency contact\n• Care conference: quarterly or after any significant change\n\n` +
        `7. MEDICATION MANAGEMENT\n• Medication review with prescribing physician at next scheduled visit\n• Controlled substances logged per AHS medication administration policy\n\n` +
        `8. 90-DAY REASSESSMENT TRIGGERS\n• Any hospital admission, significant weight change, new diagnosis, or change in functional status requires immediate reassessment.\n\n` +
        `[Note: AI service offline — this is a structured template. Review and update all clinical values with the care team before signing.]`;
    }
    return Response.json({ care_plan: aiText });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
