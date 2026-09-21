import { NextRequest } from 'next/server';
import { getPool, databaseConfigured } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return Response.json({ stories: [], summary: { totalStories: 0, totalViews: 0, totalSwipeUps: 0 } });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS snapchat_story (
        id SERIAL PRIMARY KEY,
        title TEXT,
        snap_type TEXT DEFAULT 'image',
        geo_target TEXT,
        views INTEGER DEFAULT 0,
        swipe_ups INTEGER DEFAULT 0,
        status TEXT DEFAULT 'draft',
        published_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const storiesRes = await client.query(`SELECT * FROM snapchat_story ORDER BY created_at DESC LIMIT 100`).catch(() => ({ rows: [] }));

    const stories: Array<{ views: number; swipe_ups: number }> = storiesRes.rows;
    const summary = {
      totalStories: stories.length,
      totalViews: stories.reduce((s, r) => s + Number(r.views ?? 0), 0),
      totalSwipeUps: stories.reduce((s, r) => s + Number(r.swipe_ups ?? 0), 0),
    };

    return Response.json({ stories: storiesRes.rows, summary });
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
      `INSERT INTO snapchat_story (title, snap_type, geo_target, status) VALUES ($1,$2,$3,$4) RETURNING *`,
      [body.title ?? '', body.snap_type ?? 'image', body.geo_target ?? '', body.status ?? 'draft']
    );
    return Response.json({ story: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
