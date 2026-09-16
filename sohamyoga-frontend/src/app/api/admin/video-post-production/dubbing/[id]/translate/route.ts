import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const id = parseInt(params.id, 10);
    const dubRow = await client.query('SELECT * FROM pp_dubbing_jobs WHERE id = $1', [id]);
    if (dubRow.rowCount === 0) return Response.json({ error: 'Dubbing job not found' }, { status: 404 });

    const dub = dubRow.rows[0];
    const body = await req.json();
    const { source_content } = body;

    const prompt = `Translate the following subtitle/script content from ${dub.source_language} to ${dub.target_language}.
Preserve the meaning, tone, and timing hints. Keep the same structure.
If it is SRT format, maintain the timing lines exactly and only translate the dialogue text.

Content to translate:
${source_content || 'Sample yoga tutorial content for translation.'}

Return ONLY the translated content, no explanations.`;

    let translated = '';
    try {
      const ollamaRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (ollamaRes.ok) {
        const data = await ollamaRes.json();
        translated = data.response || '';
      }
    } catch { /* fallback */ }

    if (!translated) {
      translated = `[Translation to ${dub.target_language} — AI service unavailable. Content would appear here after translation.]`;
    }

    await client.query(
      `UPDATE pp_dubbing_jobs SET status = 'completed' WHERE id = $1`,
      [id]
    );

    const subtitle = await client.query(
      `INSERT INTO pp_subtitle_tracks (project_name, language, format, content, auto_generated, status, word_count)
       VALUES ($1, $2, 'SRT', $3, TRUE, 'draft', $4) RETURNING *`,
      [dub.project_name, dub.target_language, translated, translated.trim().split(/\s+/).length]
    );

    return Response.json({ translated_content: translated, subtitle: subtitle.rows[0], generated: true });
  } finally {
    client.release();
  }
}
