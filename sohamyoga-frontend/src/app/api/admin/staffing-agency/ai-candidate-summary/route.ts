import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const skills = Array.isArray(body.skills) ? body.skills.join(', ') : (body.skills || 'N/A');
    const certifications = Array.isArray(body.certifications) ? body.certifications.join(', ') : (body.certifications || 'N/A');
    const industries = Array.isArray(body.industries) ? body.industries.join(', ') : (body.industries || 'N/A');
    const prompt = `Write a professional candidate summary for client presentation: ${body.first_name} ${body.last_name}, ${body.current_title || 'professional'} with ${body.years_experience || 0} years experience in ${industries}. Key skills: ${skills}. Certifications: ${certifications}. Desired salary: $${body.desired_salary_min || 'open'}-$${body.desired_salary_max || 'open'}. Available: ${body.availability?.replace(/_/g,' ') || 'immediately'}. Work authorization: ${body.work_authorization?.replace(/_/g,' ') || 'Canadian citizen'}. Strengths highlight for role: ${body.job_title || 'this position'}. Professional, third-person, 150-200 words. Canadian recruiter submission style.`;
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json();
      return NextResponse.json({ summary: data.response, generated_by: 'ollama' });
    } catch {
      return NextResponse.json({
        summary: `${body.first_name} ${body.last_name} is an accomplished ${body.current_title || 'professional'} with ${body.years_experience || 0} years of progressive experience in ${industries}. Demonstrating expertise in ${skills.split(',').slice(0,3).join(', ')}, ${body.first_name} brings a proven track record of delivering results in fast-paced environments.\n\nAuthorized to work in Canada as a ${body.work_authorization?.replace(/_/g,' ') || 'Canadian citizen'}, ${body.first_name} is available ${body.availability?.replace(/_/g,' ') || 'immediately'} and is seeking an opportunity where they can contribute their skills to ${body.job_title || 'this role'}.\n\n*AI summary service temporarily offline — please edit before sending to client.*`,
        generated_by: 'fallback',
      });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
