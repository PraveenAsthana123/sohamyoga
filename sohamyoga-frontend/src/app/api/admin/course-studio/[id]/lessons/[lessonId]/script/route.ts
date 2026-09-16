import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';
import { streamOllamaChat, type ChatMessage } from '@/lib/ollama';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function wordCountForDuration(minutes: number): number {
  // ~150 words/min for conversational video script
  return Math.round(minutes * 150);
}

function extractHookText(script: string): string {
  // Extract the HOOK section (first paragraph after [HOOK ...])
  const hookMatch = script.match(/\[HOOK[^\]]*\]\s*([\s\S]*?)(?=\[INTRO|\[MAIN|$)/i);
  if (hookMatch) return hookMatch[1].trim().slice(0, 500);
  // Fallback: first non-empty paragraph
  const paras = script.split('\n\n').filter(p => p.trim() && !p.trim().startsWith('['));
  return paras[0]?.trim().slice(0, 500) ?? '';
}

function extractKeyPoints(script: string): string[] {
  // Extract bullet points from SUMMARY section
  const summaryMatch = script.match(/\[SUMMARY\]([\s\S]*?)(?=\[CTA|\[CALL|$)/i);
  const section = summaryMatch ? summaryMatch[1] : script;
  const bullets = section.match(/[•·\-\*]\s*(.+)/g) ?? [];
  return bullets.slice(0, 6).map(b => b.replace(/^[•·\-\*]\s*/, '').trim());
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; lessonId: string } }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const body = await req.json() as {
      topic?: string;
      duration_minutes?: number;
      lesson_type?: string;
      audience_level?: string;
      style?: string;
      include_hook?: boolean;
      additional_context?: string;
    };

    const {
      topic = 'Lesson Topic',
      duration_minutes = 5,
      lesson_type = 'Video Tutorial',
      audience_level = 'beginner',
      style = 'educational',
      include_hook = true,
      additional_context = '',
    } = body;

    const wordCount = wordCountForDuration(duration_minutes);

    const hookInstruction = include_hook
      ? `[HOOK - 0:00-0:30] Attention-grabbing opening — a compelling question, bold statement, or surprising fact that makes the viewer stay.`
      : '';

    const prompt = `Write a ${duration_minutes}-minute ${lesson_type} lesson script about "${topic}" for a ${audience_level} audience.
Style: ${style} (educational/conversational/motivational/demonstrative).
${additional_context ? `Additional context: ${additional_context}` : ''}

Structure your script using these exact section markers:

${hookInstruction}
[INTRO - 0:30-1:00] Introduce what we'll cover and why it matters to the viewer.
[MAIN CONTENT] Organized teaching sections with approximate timestamps. Each section should have a clear label like [SECTION 1 - Title (1:00-3:00)].
[SUMMARY] Key takeaways as bullet points using • character.
[CTA] Call to action — what should the viewer do next?

Include:
- Key teaching points clearly explained
- Natural transition phrases between sections
- Visual cues in [brackets] for b-roll or on-screen text
- Real examples or demonstrations where relevant
- Conversational, engaging language appropriate for video

Target word count: ${wordCount} words. Do not add any preamble outside the script structure.`;

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'You are an expert video course script writer specializing in engaging educational content. Write complete, production-ready scripts following the exact structure requested.',
      },
      { role: 'user', content: prompt },
    ];

    let script = '';
    for await (const chunk of streamOllamaChat(messages)) {
      script += chunk;
    }
    if (!script.trim()) {
      script = `[HOOK - 0:00-0:30]\n${topic} is about to change the way you think about this subject.\n\n[INTRO - 0:30-1:00]\nIn this lesson, we'll cover the key principles of ${topic} for ${audience_level} learners.\n\n[MAIN CONTENT]\n[SECTION 1 - Core Concept (1:00-3:00)]\nLet's start with the fundamentals...\n\n[SUMMARY]\n• Key concept 1\n• Key concept 2\n• Key concept 3\n\n[CTA]\nPractice what you learned today and move on to the next lesson!`;
    }

    const hook_text = extractHookText(script);
    const key_points = extractKeyPoints(script);
    const actual_word_count = script.split(/\s+/).filter(Boolean).length;
    const estimated_duration_minutes = Math.round(actual_word_count / 150);

    // Save to lesson
    await pool.query(
      `UPDATE course_lessons SET ai_script=$1, hook_text=$2, key_points=$3 WHERE id=$4 AND course_id=$5`,
      [script, hook_text || null, key_points, params.lessonId, params.id]
    );

    return Response.json({
      script,
      hook_text,
      key_points,
      word_count: actual_word_count,
      estimated_duration_minutes,
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
