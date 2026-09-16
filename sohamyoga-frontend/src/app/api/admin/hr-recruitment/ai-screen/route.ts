export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const { job_requirements, applicant_skills, experience, cover_letter } = body;

  const prompt = `You are a Canadian HR recruiter screening a job applicant.

Job Requirements: ${job_requirements}
Applicant Skills: ${(applicant_skills || []).join(', ')}
Years of Experience: ${experience || 'Not specified'}
Cover Letter Excerpt: ${cover_letter || 'Not provided'}

Provide a structured applicant screening assessment:
1. Overall Fit Score (0-100)
2. Skills Match Analysis (list matched and missing requirements)
3. Experience Assessment
4. Strengths (3-4 points)
5. Concerns or Gaps (2-3 points)
6. Screening Recommendation: (Advance / Phone Screen / Hold / Reject)
7. Suggested Interview Questions (2-3 targeted questions)

Be objective, evidence-based, and compliant with Canadian Human Rights Act (no mention of protected characteristics).`;

  try {
    const resp = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) throw new Error('Ollama error');
    const data = await resp.json();
    return Response.json({ result: data.response });
  } catch {
    return Response.json({ result: 'AI screening unavailable. Please review applicant manually.', fallback: true });
  }
}
