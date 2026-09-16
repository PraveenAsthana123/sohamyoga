import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const { student_name, instrument, skill_level, teacher, months, recent_repertoire, strengths, areas, next_goals } = body;

  const prompt = `Write a formal student progress report for a music student: ${student_name}, ${instrument}, ${skill_level}, studying with ${teacher} for ${months} months. Recent focus: ${recent_repertoire || 'various pieces'}. Strengths: ${strengths || 'good practice habits'}. Areas for improvement: ${areas || 'technique consistency'}. Next goals: ${next_goals || 'continue current curriculum'}. Professional tone for parents. Include RCM exam recommendation if appropriate.`;

  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error('Ollama error');
    const data = await res.json() as { response: string };
    return Response.json({ report: data.response });
  } catch {
    return Response.json({
      report: `Progress Report — ${student_name}\n\nInstrument: ${instrument} | Level: ${skill_level} | Teacher: ${teacher}\n\nDear Parent/Guardian,\n\nIt is a pleasure to share ${student_name}'s progress after ${months} months of study. ${student_name} has demonstrated consistent dedication and growth in their musical journey.\n\nStrengths: ${strengths || 'Shows enthusiasm and regular practice.'}\n\nAreas for Growth: ${areas || 'Continued focus on technical precision will yield excellent results.'}\n\nRecent Repertoire: ${recent_repertoire || 'RCM-assigned pieces.'}\n\nNext Steps: ${next_goals || 'Continue building on current foundation.'}\n\nWe look forward to continued progress. Please don't hesitate to reach out with any questions.\n\nNote: AI service unavailable — fallback template used.`,
    });
  }
}
