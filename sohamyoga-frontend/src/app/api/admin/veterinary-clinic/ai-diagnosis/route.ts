import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { species, breed, age, symptoms, weight_kg, current_medications, patient_name = 'the patient' } = body;
    if (!species || !symptoms) return Response.json({ error: 'species, symptoms required' }, { status: 400 });
    const prompt = `You are a veterinary assistant. Patient: ${species}${breed ? ` (${breed})` : ''}, ${age ? `${age} year(s) old` : 'age unknown'}, ${sex || ''}. Patient name: ${patient_name}. Presenting symptoms: ${symptoms}. Weight: ${weight_kg ? `${weight_kg}kg` : 'unknown'}. Current medications: ${current_medications || 'none'}. Provide: differential diagnoses (list top 3-5), recommended diagnostics, initial treatment approach, monitoring parameters, and owner education points. Note: this is clinical decision support, not a diagnosis — always defer to the attending veterinarian.`;
    let notes = '';
    let aiUsed = false;
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) {
        const data = await res.json();
        notes = data.response || '';
        aiUsed = true;
      }
    } catch { /* Ollama unavailable */ }
    if (!notes) {
      notes = `CLINICAL DECISION SUPPORT — ${patient_name} (${species}${breed ? ` ${breed}` : ''})

DISCLAIMER: This is AI-generated clinical decision support only. Always defer to the attending veterinarian for diagnosis and treatment decisions.

PRESENTING SYMPTOMS: ${symptoms}

DIFFERENTIAL DIAGNOSES TO CONSIDER:
1. Primary diagnosis based on species and symptom pattern — requires physical examination
2. Secondary differential — rule out with diagnostics
3. Tertiary consideration — based on age and weight

RECOMMENDED DIAGNOSTICS:
- Complete physical examination
- CBC and serum chemistry panel
- Urinalysis if applicable
- Radiographs as indicated by exam findings
- Specific tests based on symptom presentation

INITIAL TREATMENT APPROACH:
- Supportive care as appropriate
- Pain management if indicated
- Fluid therapy if dehydrated
- Dietary modifications if GI involvement
- Medications per veterinarian discretion

MONITORING PARAMETERS:
- Temperature, pulse, respiration (TPR) — baseline and q4-6h if hospitalized
- Appetite and water intake monitoring
- Weight monitoring if chronic condition
- Owner-reported behavioral changes

OWNER EDUCATION:
- Signs of deterioration requiring immediate return
- Medication administration instructions if prescribed
- Diet and activity restrictions
- Follow-up appointment timing
- Emergency contact information

NOTE: Weight ${weight_kg ? `${weight_kg}kg` : 'unknown'} — dose calculations must be verified by the attending DVM before any medication is dispensed.`;
    }
    return Response.json({ notes, ai_used: aiUsed });
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}
