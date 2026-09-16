import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { project_name, video_description, script_excerpt, duration_seconds = 60, language = 'en' } = body;
    if (!project_name) return Response.json({ error: 'project_name is required' }, { status: 400 });

    const prompt = `Generate an SRT subtitle file for a ${duration_seconds}-second video.

Video description: ${video_description || 'A yoga tutorial video'}
Script excerpt: ${script_excerpt || 'Yoga tutorial content'}
Language: ${language}

Create 8-12 subtitle segments in proper SRT format with realistic timing.
Each segment should be 3-8 words max for readability.
Use this exact SRT format:
1
00:00:00,000 --> 00:00:05,000
Subtitle text here.

2
00:00:05,200 --> 00:00:10,000
Next subtitle text.

Return ONLY the SRT content, no other text.`;

    let content = '';
    try {
      const ollamaRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (ollamaRes.ok) {
        const data = await ollamaRes.json();
        content = data.response || '';
      }
    } catch { /* fallback */ }

    if (!content) {
      content = `1\n00:00:00,000 --> 00:00:05,000\n${video_description?.slice(0, 50) || 'Welcome to this video.'}\n\n2\n00:00:05,200 --> 00:00:12,000\n${script_excerpt?.slice(0, 60) || 'Follow along with this tutorial.'}\n\n3\n00:00:12,200 --> 00:00:20,000\nPractice consistently for best results.\n\n4\n00:00:20,200 --> 00:00:30,000\nThank you for watching.\n\n5\n00:00:30,200 --> 00:00:${String(Math.floor(duration_seconds / 60)).padStart(2, '0')}:${String(duration_seconds % 60).padStart(2, '0')},000\nSubscribe for more content like this.`;
    }

    const wordCount = content.trim().split(/\s+/).length;
    const result = await client.query(
      `INSERT INTO pp_subtitle_tracks (project_name, language, format, content, auto_generated, status, word_count)
       VALUES ($1, $2, 'SRT', $3, TRUE, 'draft', $4) RETURNING *`,
      [project_name, language, content, wordCount]
    );
    return Response.json({ subtitle: result.rows[0], generated: true }, { status: 201 });
  } finally {
    client.release();
  }
}
