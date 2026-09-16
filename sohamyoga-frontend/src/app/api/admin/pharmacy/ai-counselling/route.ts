import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  try { await requireAdmin(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const { drug_name, strength, directions, patient_name } = await req.json();

  const prompt = `Create patient counselling notes for: ${drug_name} ${strength}, ${directions}. Include: what this medication treats, how to take it, common side effects, serious side effects to watch for, drug-food interactions, storage instructions, and when to contact a doctor. Written in plain language for patients.`;

  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json();
    return Response.json({ result: data.response, ai: true, drug_name, strength, patient_name });
  } catch {
    const fallback = `PATIENT MEDICATION COUNSELLING SHEET

Medication: ${drug_name} ${strength}
Instructions: ${directions}
Patient: ${patient_name ?? 'Patient'}
Date: ${new Date().toLocaleDateString('en-CA')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW TO TAKE THIS MEDICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Take as directed: ${directions}
• Do not skip doses; take at the same time each day
• If you miss a dose, take it as soon as you remember unless it is almost time for the next dose

STORAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Store at room temperature (15–25°C), away from heat and moisture
• Keep out of reach of children

WHEN TO CONTACT YOUR DOCTOR OR PHARMACIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• If you experience unusual or severe symptoms
• If you start any new medications (prescription or over-the-counter)
• If you are pregnant, planning pregnancy, or breastfeeding

⚠️ AI counselling unavailable — please consult your pharmacist for personalized counselling.`;
    return Response.json({ result: fallback, ai: false, drug_name, strength, patient_name });
  }
}
