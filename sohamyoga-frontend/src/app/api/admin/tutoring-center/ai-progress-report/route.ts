import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { student_name, grade_level, subject, sessions_count, student_progress_trend, strengths, weaknesses, learning_goals } = body;

    const prompt = `Write a progress report for a tutoring student: ${student_name || 'Student'}, Grade ${grade_level || '9'}, subject: ${subject || 'Math'}. Sessions completed: ${sessions_count || 0}. Recent progress: ${student_progress_trend || 'steady'}. Strengths: ${Array.isArray(strengths) ? strengths.join(', ') : (strengths || 'working hard')}. Areas to improve: ${Array.isArray(weaknesses) ? weaknesses.join(', ') : (weaknesses || 'concept application')}. Goals: ${learning_goals || 'improve grades and confidence'}. Professional tone for parents. Include specific Alberta curriculum expectations met.`;

    let report = '';
    try {
      const aiRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (aiRes.ok) {
        const data = await aiRes.json() as { response?: string };
        report = data.response || '';
      }
    } catch {
      const today = new Date().toLocaleDateString('en-CA');
      report = `STUDENT PROGRESS REPORT\nDate: ${today}\n\nStudent: ${student_name || 'Student'} | Grade: ${grade_level} | Subject: ${subject}\nSessions Completed: ${sessions_count || 0}\n\nDEAR PARENT/GUARDIAN,\n\nWe are pleased to provide this progress update for ${student_name || 'your child'} following ${sessions_count || 0} tutoring sessions in ${subject}.\n\nPROGRESS SUMMARY\nOverall progress has been ${student_progress_trend || 'steady'}. ${student_name || 'Your child'} continues to demonstrate dedication during our sessions.\n\nSTRENGTHS\n${Array.isArray(strengths) && strengths.length ? strengths.map((s: string) => `• ${s}`).join('\n') : '• Positive attitude and effort'}\n\nAREAS FOR CONTINUED GROWTH\n${Array.isArray(weaknesses) && weaknesses.length ? weaknesses.map((w: string) => `• ${w}`).join('\n') : '• Application of concepts to new problems'}\n\nGOALS & NEXT STEPS\nWorking toward: ${learning_goals || 'improved academic performance'}\n\nWe recommend continuing with the current session frequency. Please feel free to contact us with any questions.\n\n[AI service unavailable — report generated from template]`;
    }
    return Response.json({ report });
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}
