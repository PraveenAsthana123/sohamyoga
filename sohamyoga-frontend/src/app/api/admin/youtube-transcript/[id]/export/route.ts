import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const format = req.nextUrl.searchParams.get('format') ?? 'txt';

  if (!['txt', 'srt', 'json'].includes(format)) {
    return Response.json({ error: 'format must be txt, srt, or json.' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const transcriptRes = await client.query(`
      SELECT id, video_id, video_title, channel_name, channel_id, duration_seconds,
             published_at, thumbnail_url, video_url, language,
             transcript_raw, transcript_srt, word_count, status,
             ai_summary, ai_key_topics, ai_sentiment,
             created_at, updated_at
      FROM youtube_transcripts
      WHERE id = $1
    `, [id]);

    if (!transcriptRes.rowCount) {
      return Response.json({ error: 'Transcript not found.' }, { status: 404 });
    }

    const t = transcriptRes.rows[0];
    const safeTitle = (t.video_title ?? t.video_id ?? 'transcript')
      .replace(/[^a-z0-9_\-\s]/gi, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 80);

    if (format === 'txt') {
      const content = t.transcript_raw ?? 'No transcript available.';
      return new Response(content, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${safeTitle}.txt"`,
        },
      });
    }

    if (format === 'srt') {
      const content = t.transcript_srt ?? 'No SRT data available.';
      return new Response(content, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${safeTitle}.srt"`,
        },
      });
    }

    // JSON format: full metadata + segments
    const segmentsRes = await client.query(`
      SELECT id, start_seconds, duration_seconds, text, seq_num
      FROM youtube_transcript_segments
      WHERE transcript_id = $1
      ORDER BY seq_num ASC
    `, [id]);

    const payload = {
      transcript: t,
      segments: segmentsRes.rows,
      exportedAt: new Date().toISOString(),
    };

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeTitle}.json"`,
      },
    });
  } catch (err) {
    console.error('[youtube-transcript/[id]/export GET]', err);
    return Response.json({ error: 'Failed to export transcript.' }, { status: 500 });
  } finally {
    client.release();
  }
}
