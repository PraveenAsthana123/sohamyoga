import { NextRequest } from 'next/server';
import { getPool, databaseConfigured } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return Response.json({ posts: [], threads: [], summary: { totalPosts: 0, totalImpressions: 0, totalLikes: 0, totalRetweets: 0 } });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS twitter_post (
        id SERIAL PRIMARY KEY,
        content TEXT,
        hashtags TEXT,
        impressions INTEGER DEFAULT 0,
        likes INTEGER DEFAULT 0,
        retweets INTEGER DEFAULT 0,
        status TEXT DEFAULT 'draft',
        published_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS twitter_thread (
        id SERIAL PRIMARY KEY,
        title TEXT,
        post_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'draft',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const [postsRes, threadsRes] = await Promise.all([
      client.query(`SELECT * FROM twitter_post ORDER BY created_at DESC LIMIT 100`).catch(() => ({ rows: [] })),
      client.query(`SELECT * FROM twitter_thread ORDER BY created_at DESC LIMIT 50`).catch(() => ({ rows: [] })),
    ]);

    const posts: Array<{ impressions: number; likes: number; retweets: number }> = postsRes.rows;
    const summary = {
      totalPosts: posts.length,
      totalImpressions: posts.reduce((s, r) => s + Number(r.impressions ?? 0), 0),
      totalLikes: posts.reduce((s, r) => s + Number(r.likes ?? 0), 0),
      totalRetweets: posts.reduce((s, r) => s + Number(r.retweets ?? 0), 0),
    };

    return Response.json({ posts: postsRes.rows, threads: threadsRes.rows, summary });
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
    const result = await client.query(
      `INSERT INTO twitter_post (content, hashtags, status) VALUES ($1,$2,$3) RETURNING *`,
      [body.content ?? '', body.hashtags ?? '', body.status ?? 'draft']
    );
    return Response.json({ post: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
