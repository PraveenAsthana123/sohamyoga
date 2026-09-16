import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { child_name, activities, mood, meals, nap, notes } = body;
    if (!child_name) return Response.json({ error: 'child_name required' }, { status: 400 });

    const prompt = `You are a warm, professional early childhood educator writing a daily report for parents. Write a friendly, engaging message about their child's day.

Child: ${child_name}
Mood today: ${mood || 'happy'}
Activities: ${activities?.join(', ') || 'various activities'}
Meals: ${JSON.stringify(meals || {})}
Nap: ${nap || 'Had a nap today'}
Additional notes: ${notes || 'None'}

Write a 3-4 paragraph parent-friendly daily update that:
1. Opens warmly and mentions the child by name
2. Describes their mood and energy
3. Highlights activities and learning moments (be specific and developmental)
4. Notes meals and nap
5. Closes warmly with something encouraging for the parents

Keep the tone warm, professional, and positive. Avoid clinical language. Parents love details about what their child said or did.`;

    let message = '';
    try {
      const ollamaRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (ollamaRes.ok) {
        const data = await ollamaRes.json();
        message = data.response ?? '';
      }
    } catch {
      // Graceful fallback
    }

    if (!message) {
      const mealSummary = meals ? Object.entries(meals).map(([m, v]) => `${m}: ${v}`).join(', ') : 'meals as scheduled';
      message = `Hi! We hope you're having a wonderful day.\n\n${child_name} had a ${mood || 'lovely'} day with us today! ${activities?.length ? `We enjoyed ${activities.join(', ')}` : 'We had a busy and fun day together'}.\n\nFor meals today: ${mealSummary}. ${nap ? `Nap time: ${nap}.` : ''}\n\n${notes ? notes + '\n\n' : ''}We love having ${child_name} with us — see you tomorrow!\n\nWarm regards,\nThe Childcare Team\n\n(Note: AI message generation was offline. Message generated from template.)`;
    }

    return Response.json({ message, child_name });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
