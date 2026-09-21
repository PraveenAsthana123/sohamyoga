import { NextRequest } from 'next/server';
import { getPool, databaseConfigured } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return Response.json({ mentions: [], keywords: [], summary: { totalMentions: 0, positiveMentions: 0, negativeMentions: 0, neutralMentions: 0 } });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS reddit_mention (
        id SERIAL PRIMARY KEY,
        subreddit TEXT,
        post_title TEXT,
        post_url TEXT,
        sentiment TEXT DEFAULT 'neutral',
        upvotes INTEGER DEFAULT 0,
        comments INTEGER DEFAULT 0,
        found_at TIMESTAMPTZ DEFAULT NOW(),
        status TEXT DEFAULT 'new'
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS reddit_keyword (
        id SERIAL PRIMARY KEY,
        keyword TEXT NOT NULL,
        subreddits TEXT,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const [mentionsRes, keywordsRes] = await Promise.all([
      client.query(`SELECT * FROM reddit_mention ORDER BY found_at DESC LIMIT 100`).catch(() => ({ rows: [] })),
      client.query(`SELECT * FROM reddit_keyword ORDER BY created_at DESC LIMIT 50`).catch(() => ({ rows: [] })),
    ]);

    const mentions: Array<{ sentiment: string }> = mentionsRes.rows;
    const summary = {
      totalMentions: mentions.length,
      positiveMentions: mentions.filter(m => m.sentiment === 'positive').length,
      negativeMentions: mentions.filter(m => m.sentiment === 'negative').length,
      neutralMentions: mentions.filter(m => m.sentiment === 'neutral').length,
    };

    return Response.json({ mentions: mentionsRes.rows, keywords: keywordsRes.rows, summary });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const pool = getPool();
  const client = await pool.connect();
  try {
    if (body.type === 'keyword') {
      const result = await client.query(
        `INSERT INTO reddit_keyword (keyword, subreddits, active) VALUES ($1,$2,$3) RETURNING *`,
        [body.keyword ?? '', body.subreddits ?? '', body.active !== false]
      );
      return Response.json({ keyword: result.rows[0] }, { status: 201 });
    } else {
      const result = await client.query(
        `INSERT INTO reddit_mention (subreddit, post_title, post_url, sentiment, upvotes, comments) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [body.subreddit ?? '', body.post_title ?? '', body.post_url ?? '', body.sentiment ?? 'neutral', body.upvotes ?? 0, body.comments ?? 0]
      );
      return Response.json({ mention: result.rows[0] }, { status: 201 });
    }
  } finally {
    client.release();
  }
}
