export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const applicant = await client.query(`
      SELECT a.*, j.title AS job_title, j.requirements AS job_requirements
      FROM hr_applicant a
      LEFT JOIN hr_job_posting j ON j.id = a.job_id
      WHERE a.id = $1
    `, [params.id]);

    if (!applicant.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    const a = applicant.rows[0];

    const prompt = `You are a Canadian HR recruiter screening an applicant.
Job: ${a.job_title || 'Not specified'}
Job Requirements: ${(a.job_requirements || []).join(', ') || 'Not specified'}
Applicant Skills: ${(a.skills || []).join(', ') || 'None listed'}
Experience: ${a.years_experience || 'Not specified'} years
Current Title: ${a.current_title || 'Not specified'}
Cover Letter: ${a.cover_letter || 'Not provided'}

Provide: 1) Fit Score (0-100), 2) Skills Match, 3) Strengths, 4) Gaps, 5) Recommendation (Advance/Hold/Reject).
Be objective and Canadian Human Rights Act compliant (no protected characteristics).`;

    try {
      const resp = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (!resp.ok) throw new Error('Ollama error');
      const data = await resp.json();
      return Response.json({ result: data.response, applicant: { name: a.name, id: a.id } });
    } catch {
      return Response.json({
        result: `AI screening unavailable. Manual review required for ${a.name}.`,
        fallback: true,
        applicant: { name: a.name, id: a.id },
      });
    }
  } finally {
    client.release();
  }
}
