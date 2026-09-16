export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const { title, level, duration_hours } = body;
  if (!title) return Response.json({ error: 'title required' }, { status: 400 });

  const levelDesc = level || 'beginner';
  const hours = duration_hours || 10;

  const prompt = `You are a curriculum designer for a digital marketing academy. Create a detailed course curriculum for:
Course Title: "${title}"
Level: ${levelDesc}
Total Duration: ${hours} hours

Design a complete curriculum with:
1. Course Overview (2-3 sentences describing what students will learn)
2. Prerequisites (2-3 bullet points)
3. Learning Objectives (4-5 SMART objectives starting with action verbs)
4. Course Modules (5-8 modules, each with):
   - Module number and title
   - Duration (minutes)
   - Topics covered (3-4 bullet points)
   - Practical exercise or project
5. Assessment Methods
6. Certificate Requirements

Format clearly with sections and sub-sections. Be practical and industry-relevant.`;

  try {
    const r = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    const d = await r.json();
    return Response.json({ curriculum: d.response || '', title, level: levelDesc, duration_hours: hours });
  } catch {
    return Response.json({ error: 'AI service unavailable' }, { status: 503 });
  }
}
