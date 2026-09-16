export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const { job_title, interview_type, focus_areas } = body;

  if (!job_title) return Response.json({ error: 'job_title required' }, { status: 400 });

  const prompt = `You are a Canadian HR specialist creating structured interview questions.

Job Title: ${job_title}
Interview Type: ${interview_type || 'General'}
Focus Areas: ${(focus_areas || []).join(', ') || 'general competencies'}

Generate 10-12 STAR-format (Situation, Task, Action, Result) behavioral interview questions.
Include:
1. 3-4 competency-based STAR questions specific to the role
2. 2-3 situational judgment questions
3. 2-3 technical/skills-based questions
4. 1-2 cultural fit / values questions
5. 1-2 Canadian workplace questions (teamwork, diversity, remote work if applicable)

Format each question clearly numbered. For STAR questions, include a brief "what to listen for" note.
Avoid any questions that could violate the Canadian Human Rights Act (no age, family status, religion, national origin, disability questions unless directly job-relevant and BFOR-justified).`;

  try {
    const resp = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) throw new Error('Ollama error');
    const data = await resp.json();
    return Response.json({ result: data.response, job_title, interview_type });
  } catch {
    return Response.json({ result: 'AI question generation unavailable. Please create questions manually.', fallback: true });
  }
}
