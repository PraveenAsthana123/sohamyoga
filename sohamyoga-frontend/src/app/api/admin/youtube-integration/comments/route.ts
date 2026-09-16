import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureSchema() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS youtube_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      comment_id TEXT UNIQUE NOT NULL,
      video_id TEXT NOT NULL,
      author_name TEXT,
      author_channel_id TEXT,
      text TEXT,
      like_count INT DEFAULT 0,
      reply_count INT DEFAULT 0,
      is_top_comment BOOLEAN DEFAULT false,
      published_at TEXT,
      sentiment TEXT,
      is_responded BOOLEAN DEFAULT false,
      response_text TEXT,
      scraped_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const pool = getPool();
    await ensureSchema();

    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get('video_id');
    const sentiment = searchParams.get('sentiment');
    const responded = searchParams.get('responded');

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (videoId) {
      conditions.push(`video_id = $${values.length + 1}`);
      values.push(videoId);
    }
    if (sentiment && sentiment !== 'all') {
      conditions.push(`sentiment = $${values.length + 1}`);
      values.push(sentiment);
    }
    if (responded === 'false') {
      conditions.push('is_responded = false');
    } else if (responded === 'true') {
      conditions.push('is_responded = true');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT c.*, v.title AS video_title
       FROM youtube_comments c
       LEFT JOIN youtube_videos v ON v.video_id = c.video_id
       ${where}
       ORDER BY c.scraped_at DESC`,
      values
    );

    const totalComments = rows.length;
    const positive = rows.filter((r: Record<string, unknown>) => r.sentiment === 'positive').length;
    const negative = rows.filter((r: Record<string, unknown>) => r.sentiment === 'negative').length;
    const neutral = rows.filter((r: Record<string, unknown>) => r.sentiment === 'neutral').length;

    return Response.json({
      comments: rows,
      stats: {
        total: totalComments,
        positive,
        negative,
        neutral,
        positivePct: totalComments > 0 ? Math.round((positive / totalComments) * 100) : 0,
        negativePct: totalComments > 0 ? Math.round((negative / totalComments) * 100) : 0,
        neutralPct: totalComments > 0 ? Math.round((neutral / totalComments) * 100) : 0,
        unresponded: rows.filter((r: Record<string, unknown>) => !r.is_responded).length,
      },
    });
  } catch (err) {
    console.error('[youtube-comments GET]', err);
    return Response.json({ error: 'Failed to load comments' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const pool = getPool();
    await ensureSchema();

    const body = await req.json() as { comment_id: string; reply_text: string };
    if (!body.comment_id || !body.reply_text) {
      return Response.json({ error: 'comment_id and reply_text are required' }, { status: 400 });
    }

    const hasOAuth = Boolean(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_REFRESH_TOKEN);

    if (!hasOAuth) {
      // Still save the response locally
      await pool.query(
        `UPDATE youtube_comments SET response_text = $1, is_responded = true WHERE comment_id = $2`,
        [body.reply_text, body.comment_id]
      );
      return Response.json({
        warning: 'Comment replies require YouTube OAuth setup. Reply saved locally. Use YouTube Studio to post manually.',
        saved: true,
        youtubeStudioUrl: 'https://studio.youtube.com',
      });
    }

    // OAuth path: exchange refresh token for access token
    let accessToken: string | null = null;
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.YOUTUBE_CLIENT_ID!,
          client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
          refresh_token: process.env.YOUTUBE_REFRESH_TOKEN!,
          grant_type: 'refresh_token',
        }).toString(),
        signal: AbortSignal.timeout(10000),
      });
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json() as { access_token?: string };
        accessToken = tokenData.access_token || null;
      }
    } catch (e) {
      console.error('[yt-comments OAuth]', e);
    }

    if (!accessToken) {
      return Response.json({ error: 'Failed to obtain YouTube OAuth access token' }, { status: 500 });
    }

    // Post reply
    const replyRes = await fetch(
      'https://www.googleapis.com/youtube/v3/comments?part=snippet',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          snippet: {
            parentId: body.comment_id,
            textOriginal: body.reply_text,
          },
        }),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!replyRes.ok) {
      const errData = await replyRes.json() as Record<string, unknown>;
      return Response.json({ error: 'YouTube API error', details: errData }, { status: 502 });
    }

    const ytResult = await replyRes.json() as Record<string, unknown>;

    await pool.query(
      `UPDATE youtube_comments SET response_text = $1, is_responded = true WHERE comment_id = $2`,
      [body.reply_text, body.comment_id]
    );

    return Response.json({ reply: ytResult, saved: true });
  } catch (err) {
    console.error('[youtube-comments POST]', err);
    return Response.json({ error: 'Failed to post reply' }, { status: 500 });
  }
}
