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

async function ollamaSentiment(content: string): Promise<{ sentiment: string; score: number }> {
  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2',
        prompt: `Classify sentiment of this text: "${content.slice(0, 300)}". Respond ONLY with valid JSON: {"sentiment": "positive" or "neutral" or "negative", "score": 0.0 to 1.0}`,
        stream: false,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error('ollama error');
    const data = await res.json() as { response?: string };
    const jsonMatch = (data.response ?? '').match(/\{[^}]+\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { sentiment?: string; score?: number };
      return {
        sentiment: ['positive','neutral','negative'].includes(parsed.sentiment ?? '') ? parsed.sentiment! : 'neutral',
        score: typeof parsed.score === 'number' ? Math.min(1, Math.max(0, parsed.score)) : 0.5,
      };
    }
  } catch {
    // Ollama unavailable — fall back to keyword heuristic
  }
  const lower = content.toLowerCase();
  if (/great|amazing|love|excellent|fantastic|wonderful|perfect|best/.test(lower)) return { sentiment: 'positive', score: 0.85 };
  if (/bad|terrible|worst|hate|awful|horrible|disgusting|poor/.test(lower)) return { sentiment: 'negative', score: 0.15 };
  return { sentiment: 'neutral', score: 0.5 };
}

async function captureFromFacebook(pool: ReturnType<typeof getPool>): Promise<number> {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  const pageId = process.env.META_PAGE_ID;
  if (!token || !pageId) return 0;

  let captured = 0;
  try {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${pageId}/feed?fields=id,message,created_time,comments{message,from,created_time}&access_token=${token}&limit=10`,
      { signal: AbortSignal.timeout(8_000) },
    );
    if (!res.ok) return 0;
    const data = await res.json() as { data?: Array<{ id: string; message?: string; comments?: { data: Array<{ id: string; message: string; from: { name: string } }> } }> };

    for (const post of (data.data ?? []).slice(0, 5)) {
      for (const comment of (post.comments?.data ?? [])) {
        const existing = await pool.query('SELECT id FROM social_insights WHERE external_id=$1', [comment.id]);
        if (existing.rows.length > 0) continue;
        const { sentiment, score } = await ollamaSentiment(comment.message);
        await pool.query(
          `INSERT INTO social_insights (platform, insight_type, external_id, author_name, content, sentiment, sentiment_score) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          ['facebook', 'comment', comment.id, comment.from.name, comment.message, sentiment, score],
        ).catch(() => {});
        captured++;
      }
    }
  } catch { /* API unavailable */ }
  return captured;
}

async function captureFromYouTube(pool: ReturnType<typeof getPool>): Promise<number> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const channelId = process.env.YOUTUBE_CHANNEL_ID;
  if (!apiKey || !channelId) return 0;

  let captured = 0;
  try {
    // Get recent videos
    const videosRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=3&order=date&type=video&key=${apiKey}`,
      { signal: AbortSignal.timeout(8_000) },
    );
    if (!videosRes.ok) return 0;
    const videos = await videosRes.json() as { items?: Array<{ id: { videoId: string } }> };

    for (const video of (videos.items ?? []).slice(0, 3)) {
      const commentsRes = await fetch(
        `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${video.id.videoId}&maxResults=10&key=${apiKey}`,
        { signal: AbortSignal.timeout(8_000) },
      );
      if (!commentsRes.ok) continue;
      const comments = await commentsRes.json() as { items?: Array<{ id: string; snippet: { topLevelComment: { snippet: { textDisplay: string; authorDisplayName: string; likeCount: number } } } }> };

      for (const item of (comments.items ?? []).slice(0, 5)) {
        const existing = await pool.query('SELECT id FROM social_insights WHERE external_id=$1', [item.id]);
        if (existing.rows.length > 0) continue;
        const snip = item.snippet.topLevelComment.snippet;
        const { sentiment, score } = await ollamaSentiment(snip.textDisplay);
        await pool.query(
          `INSERT INTO social_insights (platform, insight_type, external_id, author_name, content, sentiment, sentiment_score, likes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          ['youtube', 'comment', item.id, snip.authorDisplayName, snip.textDisplay, sentiment, score, snip.likeCount],
        ).catch(() => {});
        captured++;
      }
    }
  } catch { /* API unavailable */ }
  return captured;
}

async function captureFromInstagram(pool: ReturnType<typeof getPool>): Promise<number> {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  const igAccountId = process.env.INSTAGRAM_ACCOUNT_ID;
  if (!token || !igAccountId) return 0;

  let captured = 0;
  try {
    const mediaRes = await fetch(
      `https://graph.facebook.com/v18.0/${igAccountId}/media?fields=id,caption,comments_count&access_token=${token}&limit=5`,
      { signal: AbortSignal.timeout(8_000) },
    );
    if (!mediaRes.ok) return 0;
    const media = await mediaRes.json() as { data?: Array<{ id: string }> };

    for (const item of (media.data ?? []).slice(0, 3)) {
      const commentsRes = await fetch(
        `https://graph.facebook.com/v18.0/${item.id}/comments?fields=id,text,username,timestamp&access_token=${token}&limit=5`,
        { signal: AbortSignal.timeout(8_000) },
      );
      if (!commentsRes.ok) continue;
      const cData = await commentsRes.json() as { data?: Array<{ id: string; text: string; username: string }> };

      for (const c of (cData.data ?? []).slice(0, 3)) {
        const existing = await pool.query('SELECT id FROM social_insights WHERE external_id=$1', [c.id]);
        if (existing.rows.length > 0) continue;
        const { sentiment, score } = await ollamaSentiment(c.text);
        await pool.query(
          `INSERT INTO social_insights (platform, insight_type, external_id, author_name, author_handle, content, sentiment, sentiment_score) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          ['instagram', 'comment', c.id, c.username, `@${c.username}`, c.text, sentiment, score],
        ).catch(() => {});
        captured++;
      }
    }
  } catch { /* API unavailable */ }
  return captured;
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  try {
    const pool = getPool();
    await pool.query(ENSURE_TABLE);

    const [fb, yt, ig] = await Promise.all([
      captureFromFacebook(pool),
      captureFromYouTube(pool),
      captureFromInstagram(pool),
    ]);

    const total = fb + yt + ig;

    const notes: Record<string, string> = {};
    if (!process.env.META_PAGE_ACCESS_TOKEN) notes.facebook = 'META_PAGE_ACCESS_TOKEN not set — configure in environment';
    if (!process.env.META_PAGE_ACCESS_TOKEN) notes.instagram = 'META_PAGE_ACCESS_TOKEN not set — configure in environment';
    if (!process.env.YOUTUBE_API_KEY) notes.youtube = 'YOUTUBE_API_KEY not set — configure in environment';
    notes.google = 'Google Reviews requires Google Business Profile API — see https://developers.google.com/my-business/reference/rest';
    notes.yelp = 'Yelp uses Yelp Fusion API — configure YELP_API_KEY in environment';
    notes.trustpilot = 'Trustpilot requires a business invitation — data auto-captured via review_scraper if integrated';

    return Response.json({
      captured: total,
      by_platform: { facebook: fb, youtube: yt, instagram: ig },
      setup_notes: notes,
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
