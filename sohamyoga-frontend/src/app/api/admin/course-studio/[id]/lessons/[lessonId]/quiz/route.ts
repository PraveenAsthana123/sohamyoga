import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';
import { streamOllamaChat, type ChatMessage } from '@/lib/ollama';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; lessonId: string } }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT * FROM course_quizzes WHERE lesson_id=$1 ORDER BY created_at ASC`,
      [params.lessonId]
    );
    return Response.json({ quizzes: rows });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
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
      ai_generate?: boolean;
      question?: string;
      options?: string[];
      correct_index?: number;
      explanation?: string;
    };

    if (body.ai_generate) {
      // Fetch lesson script for context
      const { rows: lessonRows } = await pool.query(
        `SELECT title, ai_script, script_text FROM course_lessons WHERE id=$1`,
        [params.lessonId]
      );
      if (!lessonRows.length) return Response.json({ error: 'Lesson not found' }, { status: 404 });
      const lesson = lessonRows[0] as { title: string; ai_script: string | null; script_text: string | null };
      const scriptContext = lesson.ai_script || lesson.script_text || lesson.title;

      const prompt = `Generate 5 multiple-choice quiz questions based on this lesson content.

Lesson title: "${lesson.title}"
Content: ${scriptContext.slice(0, 2000)}

Return ONLY a valid JSON array with exactly 5 objects. Each object must have:
- "question": string (the question text)
- "options": array of exactly 4 strings (the answer choices)
- "correct_index": integer 0-3 (index of the correct answer in options)
- "explanation": string (brief explanation of why the answer is correct)

Example format:
[{"question":"...","options":["A","B","C","D"],"correct_index":1,"explanation":"..."}]

Return only the JSON array, no other text.`;

      const qMessages: ChatMessage[] = [
        {
          role: 'system',
          content: 'You are a quiz question generator. Return only valid JSON arrays, no markdown, no explanation text outside the JSON.',
        },
        { role: 'user', content: prompt },
      ];
      let response = '';
      for await (const chunk of streamOllamaChat(qMessages)) {
        response += chunk;
      }

      // Parse JSON from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return Response.json({ error: 'AI did not return valid JSON quiz data', raw: response }, { status: 500 });
      }

      let questions: Array<{ question: string; options: string[]; correct_index: number; explanation: string }>;
      try {
        questions = JSON.parse(jsonMatch[0]);
      } catch {
        return Response.json({ error: 'Failed to parse AI quiz JSON' }, { status: 500 });
      }

      const inserted = [];
      for (const q of questions.slice(0, 5)) {
        const { rows } = await pool.query(`
          INSERT INTO course_quizzes (lesson_id, question, options, correct_index, explanation)
          VALUES ($1,$2,$3,$4,$5)
          RETURNING *
        `, [params.lessonId, q.question, q.options, q.correct_index, q.explanation ?? null]);
        inserted.push(rows[0]);
      }
      return Response.json({ quizzes: inserted }, { status: 201 });
    }

    // Manual insert
    const { question, options, correct_index, explanation } = body;
    if (!question?.trim()) return Response.json({ error: 'Question is required' }, { status: 400 });
    if (!options || options.length < 2) return Response.json({ error: 'At least 2 options required' }, { status: 400 });
    if (correct_index === undefined || correct_index < 0 || correct_index >= options.length) {
      return Response.json({ error: 'Valid correct_index is required' }, { status: 400 });
    }
    const { rows } = await pool.query(`
      INSERT INTO course_quizzes (lesson_id, question, options, correct_index, explanation)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
    `, [params.lessonId, question, options, correct_index, explanation ?? null]);
    return Response.json({ quiz: rows[0] }, { status: 201 });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
