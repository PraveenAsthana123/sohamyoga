import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const { program, lessons_completed, skill_gaps } = body;

  if (!program) return Response.json({ error: 'program is required' }, { status: 400 });

  const programLabels: Record<string, string> = {
    class5_gdl: 'Alberta Class 5 GDL (Graduated Driver Licence)',
    class5_full: 'Alberta Class 5 Full Licence (non-GDL)',
    class1_melt: 'Alberta Class 1 MELT (Mandatory Entry-Level Training) — Commercial Truck',
    class6_motorcycle: 'Alberta Class 6 Motorcycle',
    refresher: 'Refresher Course',
  };

  const prompt = `You are a certified Alberta Transportation driving school instructor.
Create a personalized lesson plan for a student in the ${programLabels[program] ?? program} program.

Student context:
- Program: ${programLabels[program] ?? program}
- Lessons completed so far: ${lessons_completed ?? 0}
- Identified skill gaps: ${skill_gaps ? (Array.isArray(skill_gaps) ? skill_gaps.join(', ') : skill_gaps) : 'None identified yet'}

Please provide:
1. Next 3-5 recommended lessons with specific objectives
2. Skills to focus on based on the gaps and program stage
3. Alberta road test preparation tips relevant to this program
4. Any theory/knowledge review topics if applicable
5. Estimated lessons to road-test readiness

Format as a structured, actionable lesson plan. Be specific to Alberta driving regulations and the ${programLabels[program] ?? program} requirements.`;

  try {
    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });

    if (!ollamaRes.ok) throw new Error('Ollama returned non-OK status');
    const data = await ollamaRes.json() as { response?: string };
    return Response.json({ plan: data.response ?? '', model: 'llama3.2', source: 'ollama' });
  } catch {
    const fallback = `Lesson Plan for ${programLabels[program] ?? program} (${lessons_completed ?? 0} lessons completed)\n\n` +
      `AI generation is temporarily unavailable. Please consult the Alberta Transportation driving school curriculum guide for lesson planning. ` +
      `Skill gaps to address: ${skill_gaps ? (Array.isArray(skill_gaps) ? skill_gaps.join(', ') : skill_gaps) : 'not specified'}.`;
    return Response.json({ plan: fallback, model: null, source: 'fallback' });
  }
}
