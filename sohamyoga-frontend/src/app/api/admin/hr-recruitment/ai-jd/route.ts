export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const { title, department, requirements, type, salary_range } = body;
  if (!title) return Response.json({ error: 'title required' }, { status: 400 });

  const prompt = `You are a Canadian HR professional writing a job posting for a Canadian employer.

Job Title: ${title}
Department: ${department || 'Not specified'}
Employment Type: ${type || 'Full-time'}
Salary Range: ${salary_range || 'Competitive, commensurate with experience'}
Requirements: ${(requirements || []).join(', ') || 'Not specified'}

Write a complete, professional job description including:
1. Company Overview (placeholder text for employer to customize)
2. Position Summary
3. Key Responsibilities (8-10 bullet points)
4. Required Qualifications
5. Preferred Qualifications (Nice to Have)
6. What We Offer (benefits, vacation, etc. — include Canadian standards: min 2 weeks vacation, stat holidays, etc.)
7. How to Apply

Note: This posting is compliant with Alberta Employment Standards and the Canadian Human Rights Act. Include a brief statement about equal opportunity employment. Mention if the position is eligible for candidates requiring a work permit.`;

  try {
    const resp = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) throw new Error('Ollama error');
    const data = await resp.json();
    return Response.json({ result: data.response, title });
  } catch {
    return Response.json({
      result: `[Job Description Generator — AI temporarily unavailable]\n\nPosition: ${title}\nDepartment: ${department || 'TBD'}\nType: ${type || 'Full-time'}\nSalary: ${salary_range || 'Competitive'}\n\nPlease draft this job description manually or retry when AI is available.`,
      fallback: true,
    });
  }
}
