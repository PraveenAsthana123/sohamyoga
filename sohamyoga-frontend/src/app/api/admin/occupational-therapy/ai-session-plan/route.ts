import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const b = await req.json();
  const prompt = `Create an occupational therapy session plan for: Client age ${b.age || 'adult'}, diagnoses: ${(b.diagnosis || []).join(', ') || 'not specified'}, focus areas: ${(b.areas_of_focus || []).join(', ') || 'self-care, productivity'}. Goals: ${(b.goals || []).join('; ') || 'not specified'}. Setting: ${b.session_setting || 'clinic'}, ${b.duration || 60} minutes. Include: preparatory activities, client-centred main activities (with grading options), meaningful occupation integration, environmental modifications to consider, caregiver training component, and measurable outcome indicators. Evidence-based OT practice.`;
  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error('Ollama error');
    const data = await res.json();
    return Response.json({ plan: data.response });
  } catch {
    return Response.json({
      plan: `Occupational Therapy Session Plan (AI unavailable)\n\nClient: Age ${b.age || 'adult'} | Setting: ${b.session_setting || 'clinic'} | Duration: ${b.duration || 60} min\nDiagnosis: ${(b.diagnosis || []).join(', ') || 'Not specified'}\nFocus Areas: ${(b.areas_of_focus || []).join(', ') || 'Not specified'}\n\nPREPARATORY ACTIVITIES (10 min):\n- Sensory warm-up / fine motor preparation\n- Review of previous session and home program\n\nMAIN ACTIVITIES:\n1. Client-Centred Activity 1 (20 min): Occupational task aligned with client's roles and goals. Grade: reduce assistance → independence.\n2. Client-Centred Activity 2 (15 min): ADL/IADL practice using meaningful occupation. Data: functional performance rating.\n3. Generalisation Task (10 min): Carry-over into naturalistic context or simulated environment.\n\nENVIRONMENTAL MODIFICATIONS:\n- Assess need for adaptive equipment, lighting, ergonomic setup\n- Note safety considerations\n\nCAREGIVER TRAINING (5 min):\n- Model facilitation technique\n- Provide written home program\n\nOUTCOME INDICATORS:\n- Canadian Occupational Performance Measure (COPM) re-assessment\n- Goal Attainment Scaling (GAS) baseline vs target\n\nNext session: Reassess goals, adjust grading as appropriate.`,
      fallback: true
    });
  }
}
