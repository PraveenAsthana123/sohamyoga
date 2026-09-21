import { NextRequest } from 'next/server';
import { getPool, databaseConfigured } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return Response.json({ posts: [], summary: { totalPosts: 0, totalReactions: 0, totalComments: 0 } });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS nextdoor_post (
        id SERIAL PRIMARY KEY,
        content TEXT,
        neighborhood TEXT,
        post_type TEXT DEFAULT 'announcement',
        reactions INTEGER DEFAULT 0,
        comments INTEGER DEFAULT 0,
        status TEXT DEFAULT 'draft',
        published_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const postsRes = await client.query(`SELECT * FROM nextdoor_post ORDER BY created_at DESC LIMIT 100`).catch(() => ({ rows: [] }));

    const posts: Array<{ reactions: number; comments: number }> = postsRes.rows;
    const summary = {
      totalPosts: posts.length,
      totalReactions: posts.reduce((s, r) => s + Number(r.reactions ?? 0), 0),
      totalComments: posts.reduce((s, r) => s + Number(r.comments ?? 0), 0),
    };

    return Response.json({ posts: postsRes.rows, summary });
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
      `INSERT INTO nextdoor_post (content, neighborhood, post_type, status) VALUES ($1,$2,$3,$4) RETURNING *`,
      [body.content ?? '', body.neighborhood ?? '', body.post_type ?? 'announcement', body.status ?? 'draft']
    );
    return Response.json({ post: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
