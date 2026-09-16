import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const b = await req.json();
  const age = b.age || 'school-age';
  const prompt = `Create a speech therapy session plan for: Client age ${age}, diagnosis: ${b.primary_diagnosis || 'speech-language delay'}, focus areas: ${(b.areas_of_focus || []).join(', ') || 'articulation, language'}. Goals: ${(b.goals || []).join('; ') || 'not specified'}. Session type: ${b.session_type || 'individual'}, ${b.duration || 45} minutes. Include: warm-up activity (5 min), main therapy activities (3 activities with specific targets), data collection method, parent coaching moment, and take-home practice. Evidence-based approach. Alberta SLP practice standards.`;
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
      plan: `Speech Therapy Session Plan (AI unavailable)\n\nClient: Age ${age} | Diagnosis: ${b.primary_diagnosis || 'speech-language delay'}\nSession Type: ${b.session_type || 'individual'} | Duration: ${b.duration || 45} min\n\nWARM-UP (5 min):\n- Articulation warm-up: review last session's targets with flashcards\n\nMAIN ACTIVITIES:\n1. Target Activity (15 min): Structured practice on primary goal — ${(b.goals || ['improve speech accuracy'])[0]}. Data collection: +/- trials, 10 per target.\n2. Language Activity (15 min): Narrative/vocabulary expansion using picture scenes. Progress toward communication goals.\n3. Functional Activity (7 min): Carry-over task using targets in conversation or play.\n\nDATA COLLECTION: Trial-by-trial with prompt level noted (independent/verbal cue/model).\n\nPARENT COACHING: Review home strategies, model target elicitation technique.\n\nHOME PRACTICE: 10 min daily — practice target sounds/words in reading/conversation.\n\nNext session: Reassess progress on goals, adjust difficulty level as needed.`,
      fallback: true
    });
  }
}
