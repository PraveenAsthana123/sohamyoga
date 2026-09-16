import { NextRequest } from 'next/server';
import { databaseConfigured, getPool } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ENSURE_TABLE = `
  CREATE TABLE IF NOT EXISTS social_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform TEXT NOT NULL, insight_type TEXT NOT NULL, external_id TEXT,
    author_name TEXT, author_handle TEXT, content TEXT, rating INT,
    sentiment TEXT, sentiment_score NUMERIC(4,3), language TEXT DEFAULT 'en',
    url TEXT, media_url TEXT, likes INT DEFAULT 0, replies INT DEFAULT 0,
    shares INT DEFAULT 0, is_responded BOOLEAN DEFAULT false,
    response_text TEXT, responded_at TIMESTAMPTZ, is_flagged BOOLEAN DEFAULT false,
    tags TEXT[], captured_at TIMESTAMPTZ DEFAULT NOW()
  )
`;

async function postReplyToFacebook(commentId: string, text: string): Promise<boolean> {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  if (!token) return false;
  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/${commentId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, access_token: token }),
      signal: AbortSignal.timeout(8_000),
    });
    return res.ok;
  } catch { return false; }
}

async function postReplyToYouTube(commentId: string, text: string): Promise<boolean> {
  // YouTube Data API v3 requires OAuth — not possible with simple API key
  // In production, use OAuth2 client with youtube.comments.insert
  void commentId; void text;
  return false;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  try {
    const { id } = await context.params;
    const pool = getPool();
    await pool.query(ENSURE_TABLE);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return Response.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const { response_text } = body as Record<string, unknown>;
    if (typeof response_text !== 'string' || !response_text.trim()) {
      return Response.json({ error: 'response_text is required.' }, { status: 400 });
    }

    // Fetch the insight
    const { rows } = await pool.query('SELECT * FROM social_insights WHERE id=$1', [id]);
    if (rows.length === 0) {
      return Response.json({ error: 'Insight not found.' }, { status: 404 });
    }
    const insight = rows[0] as { platform: string; external_id: string | null };

    // Update in DB
    const { rows: updated } = await pool.query(
      `UPDATE social_insights SET is_responded=true, response_text=$1, responded_at=NOW() WHERE id=$2 RETURNING *`,
      [response_text.trim(), id],
    );

    // Attempt platform API reply
    let platformPosted = false;
    if (insight.external_id) {
      if (insight.platform === 'facebook') {
        platformPosted = await postReplyToFacebook(insight.external_id, response_text.trim());
      } else if (insight.platform === 'youtube') {
        platformPosted = await postReplyToYouTube(insight.external_id, response_text.trim());
      }
    }

    return Response.json({
      insight: updated[0],
      platform_posted: platformPosted,
      platform_note: platformPosted
        ? 'Reply posted to platform via API.'
        : 'Reply saved in DB only — platform API posting requires credentials or OAuth setup.',
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
