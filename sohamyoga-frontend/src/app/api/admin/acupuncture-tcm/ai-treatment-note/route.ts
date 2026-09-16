import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const b = await req.json();
  const prompt = `Write a Traditional Chinese Medicine treatment note for: ${b.treatment_type || 'acupuncture'} session. Patient presentation: ${b.chief_complaint || ''}. Tongue: ${b.tongue_findings || 'not recorded'}. Pulse: ${b.pulse_findings || 'not recorded'}. TCM Diagnosis: ${b.tcm_diagnosis || ''}. Pattern: ${b.pattern_differentiation || ''}. Points used: ${(b.points_needled || []).join(', ')}. Treatment: ${b.additional_treatments || 'none'}. Patient response: ${b.patient_response || 'not recorded'}. Include: SOAP format adapted for TCM, point selection rationale, herbal formula if applicable, lifestyle recommendations, and next session plan. Alberta TCM/acupuncture documentation standard.`;
  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error('Ollama error');
    const data = await res.json();
    return Response.json({ note: data.response });
  } catch {
    return Response.json({ note: `[AI unavailable] TCM Treatment Note — ${new Date().toLocaleDateString('en-CA')}\n\nS: Patient presented with ${b.chief_complaint || ''}. ${b.additional_treatments || ''}\nO: Tongue: ${b.tongue_findings || 'not recorded'}. Pulse: ${b.pulse_findings || 'not recorded'}.\nA: TCM Diagnosis: ${b.tcm_diagnosis || ''}. Pattern: ${b.pattern_differentiation || ''}.\nP: Points used: ${(b.points_needled || []).join(', ')}. Needle retention: 25 min. Patient response: ${b.patient_response || 'not recorded'}. Follow-up recommended in 1 week.` });
  }
}
