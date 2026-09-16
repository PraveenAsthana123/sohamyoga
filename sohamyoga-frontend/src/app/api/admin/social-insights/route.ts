import { NextRequest } from 'next/server';
import { databaseConfigured, getPool } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ENSURE_TABLE = `
  CREATE TABLE IF NOT EXISTS social_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform TEXT NOT NULL,
    insight_type TEXT NOT NULL,
    external_id TEXT,
    author_name TEXT,
    author_handle TEXT,
    content TEXT,
    rating INT,
    sentiment TEXT,
    sentiment_score NUMERIC(4,3),
    language TEXT DEFAULT 'en',
    url TEXT,
    media_url TEXT,
    likes INT DEFAULT 0,
    replies INT DEFAULT 0,
    shares INT DEFAULT 0,
    is_responded BOOLEAN DEFAULT false,
    response_text TEXT,
    responded_at TIMESTAMPTZ,
    is_flagged BOOLEAN DEFAULT false,
    tags TEXT[],
    captured_at TIMESTAMPTZ DEFAULT NOW()
  )
`;

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  try {
    const pool = getPool();
    await pool.query(ENSURE_TABLE);

    const url = new URL(req.url);
    const platform = url.searchParams.get('platform');
    const sentiment = url.searchParams.get('sentiment');
    const responded = url.searchParams.get('responded');
    const insightType = url.searchParams.get('insight_type');
    const flagged = url.searchParams.get('flagged');
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10), 500);

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (platform) { params.push(platform); conditions.push(`platform = $${params.length}`); }
    if (sentiment) { params.push(sentiment); conditions.push(`sentiment = $${params.length}`); }
    if (responded === 'false') conditions.push('is_responded = false');
    if (responded === 'true') conditions.push('is_responded = true');
    if (insightType) { params.push(insightType); conditions.push(`insight_type = $${params.length}`); }
    if (flagged === 'true') conditions.push('is_flagged = true');

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit);

    const { rows } = await pool.query(
      `SELECT * FROM social_insights ${where} ORDER BY captured_at DESC LIMIT $${params.length}`,
      params,
    );

    // Sentiment summary
    const { rows: sentimentStats } = await pool.query(
      `SELECT sentiment, COUNT(*) as cnt FROM social_insights GROUP BY sentiment`,
    );
    const totalSI = sentimentStats.reduce((s, r) => s + parseInt(r.cnt, 10), 0);
    const sentimentSummary = sentimentStats.map(r => ({
      sentiment: r.sentiment,
      count: parseInt(r.cnt, 10),
      pct: totalSI > 0 ? Math.round((parseInt(r.cnt, 10) / totalSI) * 100) : 0,
    }));

    // Platform breakdown
    const { rows: platformStats } = await pool.query(
      `SELECT platform, COUNT(*) as cnt, AVG(rating) FILTER (WHERE rating IS NOT NULL) as avg_rating FROM social_insights GROUP BY platform ORDER BY cnt DESC`,
    );

    return Response.json({ insights: rows, sentiment_summary: sentimentSummary, platform_stats: platformStats, total: rows.length });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  try {
    const pool = getPool();
    await pool.query(ENSURE_TABLE);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return Response.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const { platform, insight_type, author_name, author_handle, content, rating, sentiment, sentiment_score, url, tags } = body as Record<string, unknown>;

    if (typeof platform !== 'string' || !platform) {
      return Response.json({ error: 'platform is required.' }, { status: 400 });
    }
    if (typeof insight_type !== 'string' || !insight_type) {
      return Response.json({ error: 'insight_type is required.' }, { status: 400 });
    }

    const { rows } = await pool.query(
      `INSERT INTO social_insights (platform, insight_type, author_name, author_handle, content, rating, sentiment, sentiment_score, url, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [platform, insight_type,
       typeof author_name === 'string' ? author_name : null,
       typeof author_handle === 'string' ? author_handle : null,
       typeof content === 'string' ? content : null,
       typeof rating === 'number' ? rating : null,
       typeof sentiment === 'string' ? sentiment : null,
       typeof sentiment_score === 'number' ? sentiment_score : null,
       typeof url === 'string' ? url : null,
       Array.isArray(tags) ? tags : null],
    );

    return Response.json({ insight: rows[0] }, { status: 201 });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
