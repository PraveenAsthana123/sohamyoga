import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS video_posting_queue (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      reel_id UUID,
      video_project_id UUID,
      platforms TEXT[] NOT NULL,
      title TEXT NOT NULL,
      caption TEXT,
      hashtags TEXT[],
      scheduled_at TIMESTAMPTZ,
      status TEXT DEFAULT 'queued',
      results_json JSONB DEFAULT '{}',
      retry_count INT DEFAULT 0,
      error_message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

async function seedData(): Promise<void> {
  const pool = getPool();
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS c FROM video_posting_queue`);
  if (rows[0].c > 0) return;

  await pool.query(`
    INSERT INTO video_posting_queue (platforms, title, caption, hashtags, status, results_json, scheduled_at) VALUES
    (ARRAY['instagram','tiktok'], 'Morning Yoga Flow', 'Start your day right 🌅', ARRAY['#yoga','#morning','#reels'], 'posted', '{"instagram":{"ok":true,"post_id":"IG_123456"},"tiktok":{"ok":true,"post_id":"TT_789012"}}', NOW() - INTERVAL '3 days'),
    (ARRAY['youtube_shorts','instagram'], '5-Min Meditation Guide', 'Find your calm in 5 minutes 🧘', ARRAY['#meditation','#mindfulness'], 'posted', '{"youtube_shorts":{"ok":true,"video_id":"YT_abc123"},"instagram":{"ok":false,"reason":"not_configured"}}', NOW() - INTERVAL '5 days'),
    (ARRAY['instagram','facebook','linkedin'], 'Studio Promo Video', 'Join Soham Yoga Studio today! 🏛️', ARRAY['#yoga','#promo','#wellness'], 'queued', '{}', NOW() + INTERVAL '2 days'),
    (ARRAY['tiktok'], 'Viral Challenge Reel', 'Can you do this yoga pose?', ARRAY['#challenge','#yoga','#viral'], 'failed', '{"tiktok":{"ok":false,"reason":"not_configured"}}', NOW() - INTERVAL '1 day'),
    (ARRAY['instagram','youtube_shorts'], 'Breathwork Tutorial', 'Box breathing in 60 seconds', ARRAY['#breathwork','#pranayama'], 'queued', '{}', NOW() + INTERVAL '1 day')
    ON CONFLICT DO NOTHING;
  `);
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureTables();
    await seedData();
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || '';

    let q = `SELECT * FROM video_posting_queue WHERE 1=1`;
    const p: string[] = [];
    if (status) { p.push(status); q += ` AND status=$${p.length}`; }
    q += ` ORDER BY created_at DESC`;

    const { rows } = await pool.query(q, p);
    const { rows: stats } = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status='queued')::int AS queued,
        COUNT(*) FILTER (WHERE status='posted')::int AS posted,
        COUNT(*) FILTER (WHERE status='failed')::int AS failed,
        COUNT(*) FILTER (WHERE status='posting')::int AS posting
      FROM video_posting_queue
    `);
    return Response.json({ queue: rows, stats: stats[0] });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureTables();
    const pool = getPool();
    const body = await req.json() as {
      platforms: string[];
      title: string;
      caption?: string;
      hashtags?: string[];
      scheduled_at?: string;
      reel_id?: string;
      video_project_id?: string;
    };

    if (!body.platforms?.length) return Response.json({ error: 'platforms array is required' }, { status: 400 });
    if (!body.title) return Response.json({ error: 'title is required' }, { status: 400 });

    const { rows } = await pool.query(`
      INSERT INTO video_posting_queue (platforms, title, caption, hashtags, scheduled_at, reel_id, video_project_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [
      body.platforms,
      body.title,
      body.caption || '',
      body.hashtags || [],
      body.scheduled_at || null,
      body.reel_id || null,
      body.video_project_id || null,
    ]);
    return Response.json({ item: rows[0] }, { status: 201 });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
