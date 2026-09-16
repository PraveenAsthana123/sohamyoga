export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT * FROM transcription_jobs WHERE id=$1', [params.id]);
    if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    const job = rows[0];
    if (!job.transcript_text) return Response.json({ error: 'No transcript available. Process the job first.' }, { status: 400 });

    const transcriptSnippet = (job.transcript_text as string).slice(0, 800);
    const prompt = `You are an AI assistant for a yoga and wellness business. Given this transcript snippet, produce a JSON object with three fields:
1. "summary": a 3-sentence summary of the content
2. "chapters": an array of 4-5 objects each with "title" (string), "timestamp" (string like "MM:SS"), and "summary" (1 sentence)
3. "action_items": an array of 3-5 objects each with "item" (string), "owner" (string, one of: Admin/Content Team/Marketing/Social Media/Instructor), and "due_date" (string, a date within the next 7 days from 2026-09-16)

Transcript: "${transcriptSnippet}"

Respond ONLY with valid JSON, no markdown fences, no extra text.`;

    let summary = `This ${job.source_type} covers key topics from ${job.title}. The content provides valuable insights for the wellness community. Participants will gain actionable knowledge from this session.`;
    let chapters = [
      { title: 'Introduction', timestamp: '00:00', summary: 'Opening and context setting' },
      { title: 'Main Content', timestamp: '05:00', summary: 'Core teaching and techniques' },
      { title: 'Practice Section', timestamp: '20:00', summary: 'Hands-on application' },
      { title: 'Q&A and Closing', timestamp: '40:00', summary: 'Questions and wrap-up' },
    ];
    let actionItems = [
      { item: 'Share recording with participants', owner: 'Admin', due_date: '2026-09-17' },
      { item: 'Post highlights to social media', owner: 'Marketing', due_date: '2026-09-18' },
      { item: 'Update content calendar', owner: 'Content Team', due_date: '2026-09-19' },
    ];

    try {
      const ollamaRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (ollamaRes.ok) {
        const data = await ollamaRes.json() as { response?: string };
        if (data.response) {
          const parsed = JSON.parse(data.response.trim()) as { summary?: string; chapters?: typeof chapters; action_items?: typeof actionItems };
          if (parsed.summary) summary = parsed.summary;
          if (parsed.chapters) chapters = parsed.chapters;
          if (parsed.action_items) actionItems = parsed.action_items;
        }
      }
    } catch { /* use fallbacks */ }

    await client.query(`
      UPDATE transcription_jobs SET summary=$1, chapters=$2, action_items=$3 WHERE id=$4
    `, [summary, JSON.stringify(chapters), JSON.stringify(actionItems), params.id]);

    return Response.json({ summary, chapters, action_items: actionItems });
  } finally {
    client.release();
  }
}
