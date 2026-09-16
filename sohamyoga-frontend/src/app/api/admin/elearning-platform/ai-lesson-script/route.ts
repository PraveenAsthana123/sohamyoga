import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const { lesson_title, course_title, level = 'beginner', duration = 15 } = body;
  if (!lesson_title || !course_title) return Response.json({ error: 'lesson_title and course_title required' }, { status: 400 });

  const prompt = `Write an engaging lesson script for: "${lesson_title}" in course: "${course_title}". Target level: ${level}. Duration: ~${duration} minutes. Include: opening hook, core content with examples, practice exercise, key takeaways, and a transition to the next lesson.`;

  let script = '';
  try {
    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (ollamaRes.ok) {
      const data = await ollamaRes.json();
      script = data.response || '';
    }
  } catch {
    // graceful fallback
  }

  if (!script) {
    script = `# Lesson Script: ${lesson_title}\n**Course:** ${course_title} | **Level:** ${level} | **Duration:** ~${duration} min\n\n## Opening Hook (2 min)\n"Have you ever wondered how [topic] actually works in practice? By the end of this lesson, you'll have a clear, actionable understanding you can apply immediately."\n\n## Core Content (${Math.round(duration * 0.6)} min)\n[Lesson content goes here — Ollama AI is currently offline. Generate with Ollama running locally.]\n\n## Practice Exercise (${Math.round(duration * 0.2)} min)\nTry this hands-on exercise to reinforce what you've learned...\n\n## Key Takeaways\n- Point 1\n- Point 2\n- Point 3\n\n## Transition\n"In the next lesson, we'll build on what you've learned here by exploring..."`;
  }

  return Response.json({ script, lesson_title, course_title, level, duration });
}
