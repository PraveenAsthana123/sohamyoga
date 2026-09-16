import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const b = await req.json();
  const prompt = `Create a therapy session plan for a ${b.session_type || 'individual'} therapy session using ${(b.modality || []).join(', ') || 'CBT'} approach. Client presenting with: ${(b.presenting_concerns || []).join(', ')}. Current treatment goals: ${(b.goals || []).join(', ')}. Previous session: ${b.previous_session_summary || 'first session or not provided'}. Include: session objectives, opening check-in, main therapeutic activities/interventions, closure activity, homework/between-session practice, and crisis resources to mention if relevant. Alberta CCPA/RPCA ethical guidelines.`;
  const disclaimer = `\n\n---\nIMPORTANT: This is a clinical planning tool only. All clinical decisions must be made by the licensed therapist using their professional judgment and direct knowledge of the client. This output does not constitute a clinical recommendation.`;
  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error('Ollama error');
    const data = await res.json();
    return Response.json({ plan: data.response + disclaimer });
  } catch {
    return Response.json({ plan: `[AI unavailable] Session Plan Framework — ${b.session_type || 'Individual'} Session\n\nApproach: ${(b.modality || []).join(', ') || 'CBT'}\n\n1. Opening Check-in (5-10 min): Review week, mood/affect rating, any safety concerns.\n\n2. Review Previous Homework: Discuss what worked, what was challenging.\n\n3. Main Intervention (30-35 min): Address primary concern — ${(b.presenting_concerns || []).join(', ')}. Use evidence-based techniques per modality.\n\n4. Skill Building: Teach/reinforce one coping strategy.\n\n5. Closure (5 min): Summarize session, safety check, assign homework.\n\n6. Crisis Resources: Distress Centre 403-266-4357 | Crisis Line 988 | Emergency 911${disclaimer}` });
  }
}
