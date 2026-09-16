import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const b = await req.json();
  const prompt = `Create a naturopathic wellness plan for: ${b.chief_complaint || ''}, health goals: ${(b.health_goals || []).join(', ')}. Patient profile: age ${b.age || 'unknown'}, diet: ${b.diet_type || 'not specified'}, stress: ${b.stress_level || '?'}/10, sleep: ${b.sleep_hours || '?'}hr/night, exercise: ${b.exercise_frequency || 'not specified'}. Current supplements: ${(b.supplements_vitamins || []).join(', ') || 'none'}. Health conditions: ${(b.health_conditions || []).join(', ') || 'none'}. Include: root cause analysis (Naturopathic philosophy: treat the whole person), 3-month phased plan, specific supplement protocol (with Canadian brands: AOR, Metagenics, Seroyal, CanPrev, Thorne), dietary recommendations, lifestyle modifications, lab testing to consider, and expected outcomes timeline. Alberta ND scope of practice.`;
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
    return Response.json({ plan: `[AI unavailable] Naturopathic Wellness Plan — ${new Date().toLocaleDateString('en-CA')}\n\nChief Concern: ${b.chief_complaint || ''}\n\nRoot Cause Analysis: Assess ${b.chief_complaint} through the lens of gastrointestinal, hormonal, and stress-axis dysregulation.\n\nPhase 1 (Month 1): Foundation — support digestive health, reduce inflammatory load, optimize sleep.\nPhase 2 (Month 2): Address root cause — targeted supplementation, dietary protocol.\nPhase 3 (Month 3): Maintenance and prevention.\n\nSupplement Protocol (Canadian brands):\n- Metagenics Ultraflora Balance — 1 cap BID with meals\n- AOR Ortho Adapt — 2 caps AM for adrenal support\n- CanPrev Magnesium Bisglycinate — 200mg QHS for sleep/stress\n- Thorne Vitamin D/K2 — 2000IU Vitamin D with K2\n\nRecommended Labs: Comprehensive metabolic panel, thyroid (TSH, T3, T4), cortisol AM/PM, food sensitivity (IgG panel).\n\nPlease regenerate when AI is available for patient-specific plan.` });
  }
}
