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
  const pool = getPool();
  const client = await pool.connect();
  try {
    const transcriptRes = await client.query(`
      SELECT id, video_id, video_title, channel_name, channel_id, duration_seconds,
             published_at, thumbnail_url, video_url, language,
             transcript_raw, transcript_srt, word_count, status,
             error_message, ai_summary, ai_key_topics, ai_sentiment,
             created_at, updated_at
      FROM youtube_transcripts
      WHERE id = $1
    `, [id]);

    if (!transcriptRes.rowCount) {
      return Response.json({ error: 'Transcript not found.' }, { status: 404 });
    }

    const segmentsRes = await client.query(`
      SELECT id, transcript_id, start_seconds, duration_seconds, text, seq_num
      FROM youtube_transcript_segments
      WHERE transcript_id = $1
      ORDER BY seq_num ASC
    `, [id]);

    return Response.json({
      transcript: transcriptRes.rows[0],
      segments: segmentsRes.rows,
    });
  } catch (err) {
    console.error('[youtube-transcript/[id] GET]', err);
    return Response.json({ error: 'Failed to fetch transcript.' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const check = await client.query(
      `SELECT id FROM youtube_transcripts WHERE id = $1`,
      [id]
    );
    if (!check.rowCount) {
      return Response.json({ error: 'Transcript not found.' }, { status: 404 });
    }

    // Segments are deleted via ON DELETE CASCADE
    await client.query(`DELETE FROM youtube_transcripts WHERE id = $1`, [id]);

    return Response.json({ ok: true });
  } catch (err) {
    console.error('[youtube-transcript/[id] DELETE]', err);
    return Response.json({ error: 'Failed to delete transcript.' }, { status: 500 });
  } finally {
    client.release();
  }
}
