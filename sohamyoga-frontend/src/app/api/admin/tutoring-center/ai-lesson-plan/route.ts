import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { subject, grade_level, topics, learning_challenges, duration } = body;

    const prompt = `Create a tutoring session plan for: ${subject || 'Math'}, ${grade_level || 'Grade 9'} student (Alberta curriculum). Topics to cover: ${Array.isArray(topics) ? topics.join(', ') : (topics || 'review')}. Student challenges: ${learning_challenges || 'general difficulty with concepts'}. Duration: ${duration || 60} minutes. Include: warm-up review (5 min), concept instruction with examples, practice problems with difficulty progression, error analysis activity, summary + homework. Alberta Education curriculum aligned.`;

    let plan = '';
    try {
      const aiRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (aiRes.ok) {
        const data = await aiRes.json() as { response?: string };
        plan = data.response || '';
      }
    } catch {
      plan = `TUTORING SESSION PLAN\n\nSubject: ${subject} | Grade: ${grade_level} | Duration: ${duration || 60} min\n\nWARM-UP (5 min)\n• Quick review of previous session's homework\n• 2-3 mental math or quick recall questions\n\nCONCEPT INSTRUCTION (15 min)\n• Topics: ${Array.isArray(topics) ? topics.join(', ') : topics || 'review'}\n• Present concept with clear visual examples\n• Walk through 2 worked examples step-by-step\n• Check for understanding with questions\n\nGUIDED PRACTICE (15 min)\n• 3-4 problems — start easy, increase difficulty\n• Student works, tutor observes and prompts\n• Error analysis: identify patterns in mistakes\n\nINDEPENDENT PRACTICE (15 min)\n• 4-5 problems independently\n• Tutor available for guidance only\n• Timed challenge option for advanced students\n\nERROR ANALYSIS (5 min)\n• Review incorrect answers together\n• Discuss why the error occurred\n• Rework problem using correct method\n\nSUMMARY & HOMEWORK (5 min)\n• Student explains concept back (teach-back)\n• Assign 5-10 homework problems\n• Preview next session topics\n\n[AI service unavailable — plan generated from template]`;
    }
    return Response.json({ plan });
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}
