export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });

  const body = await req.json();
  const { target_language } = body;
  if (!target_language) return Response.json({ error: 'target_language is required' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT * FROM transcription_jobs WHERE id=$1', [params.id]);
    if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    const job = rows[0];
    if (!job.transcript_text) return Response.json({ error: 'No transcript available.' }, { status: 400 });

    const snippet = (job.transcript_text as string).slice(0, 600);
    const prompt = `Translate the following English text into ${target_language}. Provide only the translated text, no commentary:\n\n${snippet}`;

    let translatedText = `[${target_language} translation of "${job.title}" — translation service pending Ollama response]`;

    try {
      const ollamaRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (ollamaRes.ok) {
        const data = await ollamaRes.json() as { response?: string };
        if (data.response) translatedText = data.response.trim();
      }
    } catch { /* use fallback */ }

    await client.query(`
      INSERT INTO transcription_translations (job_id, target_language, translated_text)
      VALUES ($1, $2, $3)
    `, [params.id, target_language, translatedText]);

    return Response.json({ target_language, translated_text: translatedText });
  } finally {
    client.release();
  }
}
