import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function secondsToSRT(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = (s % 60).toFixed(3).replace('.', ',');
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(6, '0')}`;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const { rows } = await pool.query(`SELECT transcript_text, duration_seconds FROM video_projects WHERE id=$1`, [params.id]);
    if (!rows.length) return Response.json({ error: 'Project not found' }, { status: 404 });

    const transcript: string = rows[0].transcript_text || '';
    const totalDuration: number = rows[0].duration_seconds || 60;

    if (!transcript.trim()) {
      return Response.json({ error: 'No transcript text found. Add transcript_text to the project first.' }, { status: 400 });
    }

    // Split transcript into words and chunk into ~5-second segments
    const words = transcript.split(/\s+/).filter(Boolean);
    const wordsPerSecond = words.length / totalDuration;
    const chunkSeconds = 5;
    const wordsPerChunk = Math.max(1, Math.round(wordsPerSecond * chunkSeconds));

    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += wordsPerChunk) {
      chunks.push(words.slice(i, i + wordsPerChunk).join(' '));
    }

    const srtLines: string[] = [];
    chunks.forEach((text, idx) => {
      const startSec = idx * chunkSeconds;
      const endSec = Math.min((idx + 1) * chunkSeconds, totalDuration);
      srtLines.push(`${idx + 1}`);
      srtLines.push(`${secondsToSRT(startSec)} --> ${secondsToSRT(endSec)}`);
      srtLines.push(text);
      srtLines.push('');
    });

    const srt = srtLines.join('\n');

    return Response.json({ srt, caption_count: chunks.length });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
