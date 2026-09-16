import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';
import { streamOllamaChat, type ChatMessage } from '@/lib/ollama';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const body = await req.json() as {
      action: 'optimize_title' | 'generate_description' | 'auto_tags';
      title?: string;
      objectives?: string[];
      lesson_title?: string;
      lesson_topic?: string;
    };

    const { action } = body;
    let prompt = '';

    if (action === 'optimize_title') {
      const title = body.title ?? '';
      prompt = `Optimize this course title for SEO and student appeal. Return only the optimized title (max 60 characters), nothing else.\n\nOriginal title: "${title}"`;
    } else if (action === 'generate_description') {
      const title = body.title ?? '';
      const objectives = (body.objectives ?? []).slice(0, 4).join(', ');
      prompt = `Write a 155-character SEO meta description for a course titled "${title}" covering: ${objectives}. Return only the description text, no quotes, max 160 characters.`;
    } else if (action === 'auto_tags') {
      const title = body.lesson_title ?? '';
      const topic = body.lesson_topic ?? '';
      prompt = `Suggest exactly 5 relevant SEO and content tags for a lesson titled "${title}" about "${topic}". Return only a JSON array of 5 lowercase strings, no other text. Example: ["yoga","beginner","flexibility","pose","wellness"]`;
    } else {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are an SEO and content optimization assistant. Return only the requested output, no preamble, no explanation.' },
      { role: 'user', content: prompt },
    ];

    let result = '';
    for await (const chunk of streamOllamaChat(messages)) {
      result += chunk;
    }

    if (action === 'auto_tags') {
      const jsonMatch = result.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        try {
          const tags = JSON.parse(jsonMatch[0]);
          return Response.json({ tags: Array.isArray(tags) ? tags.slice(0, 5) : [] });
        } catch {
          // fall through to raw
        }
      }
      return Response.json({ tags: result.split(',').map(t => t.trim().replace(/["\[\]]/g, '')).filter(Boolean).slice(0, 5) });
    }

    // Save SEO fields back to course
    if (action === 'optimize_title') {
      const optimized = result.trim().slice(0, 60);
      await pool.query(
        `UPDATE course_productions SET seo_title=$1, updated_at=NOW() WHERE id=$2`,
        [optimized, params.id]
      );
      return Response.json({ seo_title: optimized });
    } else if (action === 'generate_description') {
      const desc = result.trim().slice(0, 160);
      await pool.query(
        `UPDATE course_productions SET seo_description=$1, updated_at=NOW() WHERE id=$2`,
        [desc, params.id]
      );
      return Response.json({ seo_description: desc });
    }

    return Response.json({ result: result.trim() });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
