import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const { course_title, level = 'beginner', category = 'other' } = body;
  if (!course_title) return Response.json({ error: 'course_title required' }, { status: 400 });

  const prompt = `Create a comprehensive online course outline for: "${course_title}" at ${level} level in ${category}. Include: course description, learning objectives (5-7), module titles and lesson breakdown (8-10 modules, 3-5 lessons each), estimated duration per lesson, prerequisite knowledge, and a compelling course sales description. Target: Canadian adult learners.`;

  let outline = '';
  try {
    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (ollamaRes.ok) {
      const data = await ollamaRes.json();
      outline = data.response || '';
    }
  } catch {
    // graceful fallback
  }

  if (!outline) {
    outline = `# ${course_title} — Course Outline (${level} level)\n\n## Course Description\nA comprehensive ${level}-level course covering ${category} fundamentals and practical applications for Canadian adult learners.\n\n## Learning Objectives\n1. Understand core concepts and terminology\n2. Apply practical techniques to real-world scenarios\n3. Build confidence through hands-on exercises\n4. Develop problem-solving skills in ${category}\n5. Create a portfolio-ready project by course end\n\n## Modules\n### Module 1: Introduction & Foundations (~45 min)\n- Lesson 1.1: Welcome & Course Overview (10 min)\n- Lesson 1.2: Core Concepts (15 min)\n- Lesson 1.3: Setting Up Your Environment (20 min)\n\n### Module 2–8: [AI generation unavailable — Ollama offline]\n\n## Prerequisites\nNo prior experience required for beginner level.\n\n## Sales Description\nJoin thousands of Canadians who have advanced their careers with this practical ${category} course. Learn at your own pace with lifetime access.`;
  }

  return Response.json({ outline, course_title, level, category });
}
