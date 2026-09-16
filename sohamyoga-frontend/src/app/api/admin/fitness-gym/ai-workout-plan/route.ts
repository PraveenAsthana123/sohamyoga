import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { member_type = 'monthly', goal = 'general fitness', fitness_level = 'beginner', days_per_week = 3 } = body;
    const prompt = `Create a 4-week progressive workout plan for a ${member_type} gym member with goal: ${goal}. Fitness level: ${fitness_level}. Available days: ${days_per_week} days per week. Include for each session: warm-up (5-10 min), main workout with sets/reps/rest, cool-down (5-10 min). Add weekly progression notes. Canadian fitness context — consider seasonal activity, indoor focus in winter. Format clearly with Week 1-4, Day labels, and a brief nutritional tip per week.`;
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) {
        const data = await res.json();
        return Response.json({ plan: data.response, source: 'ollama' });
      }
    } catch { /* fallback */ }
    // Graceful fallback
    const fallback = `4-Week Workout Plan for ${member_type} Member — Goal: ${goal}\n\nWeek 1-2 (Foundation):\n• Warm-up: 5-min light cardio + dynamic stretches\n• Main: 3×12 squats, 3×10 push-ups, 3×12 lunges, 2-min plank\n• Cool-down: 10-min static stretching\n\nWeek 3-4 (Progression):\n• Warm-up: 10-min moderate cardio\n• Main: Increase reps/sets by 10-15%, add 1 compound lift\n• Cool-down: Foam rolling + stretching\n\nNote: AI advisor (Ollama) is offline — this is a template plan. Connect Ollama for personalized programming.`;
    return Response.json({ plan: fallback, source: 'fallback' });
  } catch (e: unknown) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
