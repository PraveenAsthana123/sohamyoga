import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const { instrument, skill_level, lesson_duration, repertoire, goals } = body;

  const prompt = `Create a detailed music lesson plan for: ${instrument}, ${skill_level} level student, ${lesson_duration} minute lesson. Current repertoire: ${repertoire || 'not specified'}. Goals: ${goals || 'general improvement'}. Include: warm-up exercises (5 min), technique work (10-15 min), repertoire practice with specific feedback points, theory component, sight-reading, and practice assignment. RCM curriculum aligned.`;

  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error('Ollama error');
    const data = await res.json() as { response: string };
    return Response.json({ plan: data.response });
  } catch {
    return Response.json({
      plan: `Lesson Plan — ${instrument} (${skill_level}, ${lesson_duration} min)\n\nWarm-Up (5 min): Scales in C major, chromatic scale, hand position exercises.\n\nTechnique (15 min): Focus on ${skill_level === 'beginner' ? 'finger independence and posture' : 'tone production and articulation'}.\n\nRepertoire (${Math.max(10, lesson_duration - 25)} min): ${repertoire || 'Assigned pieces'} — review sections with difficulty, identify performance goals.\n\nTheory (5 min): RCM-aligned theory concept review.\n\nPractice Assignment: 30 min daily — scales (10 min), technique (10 min), repertoire (10 min).\n\nNote: AI service unavailable — fallback template used.`,
    });
  }
}
