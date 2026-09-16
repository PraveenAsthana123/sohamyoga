import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const prompt = `Write a recruiter outreach message to a passive candidate for: ${body.job_title || 'a senior role'} at ${body.company_name || 'a leading company'} in Calgary. Candidate's current role: ${body.current_title || 'experienced professional'}. Tailor the message to show we understand their background. Include: personalized opener, role summary (without full disclosure), why it's a good fit, and a soft call-to-action. LinkedIn message format, under 300 characters for connection request note, or full InMail version.`;
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json();
      return NextResponse.json({ message: data.response, generated_by: 'ollama' });
    } catch {
      const connectionNote = `Hi [Name], I came across your profile and was impressed by your experience as ${body.current_title || 'a professional'}. I'm working on an exciting ${body.job_title || 'opportunity'} in Calgary that may align with your career goals — would love to connect!`;
      const inmail = `Hi [Name],\n\nI hope this message finds you well. I came across your profile and was genuinely impressed by your background as ${body.current_title || 'an experienced professional'}.\n\nI'm currently working with a client on a ${body.job_title || 'senior'} opportunity in Calgary that I think could be a great next step for someone with your expertise. Without giving everything away, it offers strong compensation, a collaborative team, and real growth potential.\n\nI'd love to share more details if you're open to a brief conversation — even if you're not actively looking, it might be worth a 10-minute chat.\n\nWould you be available for a quick call this week?\n\nBest,\n[Your Name]\n[Recruiting Agency]\n\n*AI service offline — customize before sending.*`;
      return NextResponse.json({ message: inmail, connection_note: connectionNote, generated_by: 'fallback' });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
