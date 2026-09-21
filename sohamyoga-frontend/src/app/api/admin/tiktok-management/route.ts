import { NextRequest } from 'next/server';
import { getPool, databaseConfigured } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return Response.json({ posts: [], analytics: [], summary: { totalPosts: 0, totalViews: 0, totalLikes: 0, totalShares: 0 } });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS tiktok_post (
        id SERIAL PRIMARY KEY,
        caption TEXT,
        hashtags TEXT,
        video_url TEXT,
        views INTEGER DEFAULT 0,
        likes INTEGER DEFAULT 0,
        shares INTEGER DEFAULT 0,
        status TEXT DEFAULT 'draft',
        published_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS tiktok_analytics (
        id SERIAL PRIMARY KEY,
        date DATE,
        followers INTEGER DEFAULT 0,
        views INTEGER DEFAULT 0,
        likes INTEGER DEFAULT 0,
        shares INTEGER DEFAULT 0
      )
    `);

    const [postsRes, analyticsRes] = await Promise.all([
      client.query(`SELECT * FROM tiktok_post ORDER BY created_at DESC LIMIT 100`).catch(() => ({ rows: [] })),
      client.query(`SELECT * FROM tiktok_analytics ORDER BY date DESC LIMIT 30`).catch(() => ({ rows: [] })),
    ]);

    const posts: Array<{ views: number; likes: number; shares: number }> = postsRes.rows;
    const summary = {
      totalPosts: posts.length,
      totalViews: posts.reduce((s, r) => s + Number(r.views ?? 0), 0),
      totalLikes: posts.reduce((s, r) => s + Number(r.likes ?? 0), 0),
      totalShares: posts.reduce((s, r) => s + Number(r.shares ?? 0), 0),
    };

    return Response.json({ posts: postsRes.rows, analytics: analyticsRes.rows, summary });
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
      `INSERT INTO tiktok_post (caption, hashtags, video_url, status) VALUES ($1,$2,$3,$4) RETURNING *`,
      [body.caption ?? '', body.hashtags ?? '', body.video_url ?? '', body.status ?? 'draft']
    );
    return Response.json({ post: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
