export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

function buildSRT(text: string): string {
  const words = text.split(/\s+/).filter(Boolean);
  const chunkSize = 10;
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
  }
  return chunks.map((chunk, i) => {
    const startSec = i * 3;
    const endSec = startSec + 3;
    const fmt = (s: number) => {
      const h = Math.floor(s / 3600).toString().padStart(2, '0');
      const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
      const sec = (s % 60).toString().padStart(2, '0');
      return `${h}:${m}:${sec},000`;
    };
    return `${i + 1}\n${fmt(startSec)} --> ${fmt(endSec)}\n${chunk}`;
  }).join('\n\n');
}

function buildVTT(text: string): string {
  const words = text.split(/\s+/).filter(Boolean);
  const chunkSize = 10;
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
  }
  const lines = chunks.map((chunk, i) => {
    const startSec = i * 3;
    const endSec = startSec + 3;
    const fmt = (s: number) => {
      const m = Math.floor(s / 60).toString().padStart(2, '0');
      const sec = (s % 60).toString().padStart(2, '0');
      return `00:${m}:${sec}.000`;
    };
    return `${fmt(startSec)} --> ${fmt(endSec)}\n${chunk}`;
  });
  return 'WEBVTT\n\n' + lines.join('\n\n');
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });

  const body = await req.json();
  const { format } = body;
  if (!['txt', 'markdown', 'json', 'srt', 'vtt'].includes(format)) {
    return Response.json({ error: 'format must be txt|markdown|json|srt|vtt' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT * FROM transcription_jobs WHERE id=$1', [params.id]);
    if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    const job = rows[0];
    if (!job.transcript_text) return Response.json({ error: 'No transcript available.' }, { status: 400 });

    const text = job.transcript_text as string;
    let content = '';

    if (format === 'txt') {
      content = `${job.title}\n${'='.repeat(job.title.length)}\n\n${text}`;
    } else if (format === 'markdown') {
      content = `# ${job.title}\n\n**Source:** ${job.source_type} | **Language:** ${job.language} | **Words:** ${job.word_count}\n\n## Transcript\n\n${text}`;
      if (job.summary) content += `\n\n## Summary\n\n${job.summary}`;
    } else if (format === 'json') {
      content = JSON.stringify({
        id: job.id,
        title: job.title,
        source_type: job.source_type,
        language: job.language,
        word_count: job.word_count,
        transcript: text,
        summary: job.summary,
        chapters: job.chapters,
        action_items: job.action_items,
        created_at: job.created_at,
        completed_at: job.completed_at,
      }, null, 2);
    } else if (format === 'srt') {
      content = buildSRT(text);
    } else if (format === 'vtt') {
      content = buildVTT(text);
    }

    await client.query(`
      INSERT INTO transcription_exports (job_id, format, content) VALUES ($1,$2,$3)
    `, [params.id, format, content]);

    return Response.json({ format, content });
  } finally {
    client.release();
  }
}
