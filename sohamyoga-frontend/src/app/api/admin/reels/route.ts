import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reels (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      caption TEXT,
      hashtags TEXT[],
      video_project_id UUID,
      video_url TEXT,
      thumbnail_url TEXT,
      platform TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      scheduled_at TIMESTAMPTZ,
      posted_at TIMESTAMPTZ,
      external_post_id TEXT,
      views INT DEFAULT 0,
      likes INT DEFAULT 0,
      comments INT DEFAULT 0,
      shares INT DEFAULT 0,
      saves INT DEFAULT 0,
      reach INT DEFAULT 0,
      engagement_rate NUMERIC(6,4),
      duration_seconds INT,
      audio_name TEXT,
      is_trending_audio BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

async function seedData(): Promise<void> {
  const pool = getPool();
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS c FROM reels`);
  if (rows[0].c > 0) return;

  await pool.query(`
    INSERT INTO reels (title, caption, hashtags, platform, status, views, likes, comments, shares, saves, reach, engagement_rate, duration_seconds, audio_name, is_trending_audio, scheduled_at, posted_at) VALUES
    ('Morning Yoga Flow', 'Start your day with intention ✨ This 30-second flow will energize your morning.', ARRAY['#yoga','#morningroutine','#wellness','#reels','#fyp'], 'instagram', 'posted', 12400, 890, 67, 234, 410, 18600, 0.0854, 30, 'Energetic Pop Mix', false, NULL, NOW() - INTERVAL '3 days'),
    ('5-Min Meditation', 'You deserve 5 minutes of peace today. 🧘 Follow along.', ARRAY['#meditation','#mindfulness','#calm','#breathe','#fyp'], 'tiktok', 'posted', 34200, 2100, 189, 567, 890, 51300, 0.0742, 60, 'Peaceful Morning - Lo-fi', true, NULL, NOW() - INTERVAL '5 days'),
    ('Studio Tour BTS', 'A peek inside Soham Yoga Studio 🏛️ Come visit us!', ARRAY['#yogastudio','#bts','#community','#yoga'], 'instagram', 'scheduled', 0, 0, 0, 0, 0, 0, 0, 30, NULL, false, NOW() + INTERVAL '2 days', NULL),
    ('Membership Promo', '🎉 Join our community! 50% off first month — link in bio.', ARRAY['#yoga','#wellness','#offer','#promo','#deal'], 'facebook', 'posted', 5600, 310, 28, 89, 120, 8400, 0.0623, 30, 'Upbeat Corporate', false, NULL, NOW() - INTERVAL '7 days'),
    ('Breathwork Tutorial', 'Learn box breathing in 60 seconds. Your nervous system will thank you.', ARRAY['#breathwork','#pranayama','#wellness','#tips','#howto'], 'youtube_shorts', 'posted', 8900, 445, 52, 112, 233, 13350, 0.0638, 60, 'Calm Meditation Beats', false, NULL, NOW() - INTERVAL '2 days'),
    ('Power Yoga Challenge', 'Can you do this? 💪 Tag a friend to try this challenge!', ARRAY['#yogachallenge','#poweryoga','#fitness','#viral'], 'tiktok', 'scheduled', 0, 0, 0, 0, 0, 0, 0, 15, 'Trending Sound #1', true, NOW() + INTERVAL '1 day', NULL),
    ('Wellness Tips Monday', '3 wellness habits that changed my life 🌿', ARRAY['#wellnesstips','#healthylifestyle','#yoga','#monday','#motivation'], 'linkedin', 'draft', 0, 0, 0, 0, 0, 0, 0, 45, NULL, false, NULL, NULL),
    ('Chair Yoga for Desk Workers', 'You can do yoga at your desk! Try these 3 moves right now.', ARRAY['#chairyoga','#officeyoga','#deskworker','#wellness','#tips'], 'instagram', 'posted', 7800, 520, 43, 156, 290, 11700, 0.0820, 45, 'Chill Acoustic Guitar', false, NULL, NOW() - INTERVAL '1 day')
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
    const platform = searchParams.get('platform') || '';
    const status = searchParams.get('status') || '';

    let q = `SELECT * FROM reels WHERE 1=1`;
    const p: string[] = [];
    if (platform) { p.push(platform); q += ` AND platform=$${p.length}`; }
    if (status) { p.push(status); q += ` AND status=$${p.length}`; }
    q += ` ORDER BY created_at DESC`;

    const { rows } = await pool.query(q, p);
    const { rows: stats } = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status='posted')::int AS posted,
        COUNT(*) FILTER (WHERE status='scheduled')::int AS scheduled,
        COALESCE(SUM(views),0)::bigint AS total_views,
        COALESCE(SUM(likes),0)::bigint AS total_likes,
        COALESCE(AVG(engagement_rate) FILTER (WHERE engagement_rate > 0),0)::numeric AS avg_engagement
      FROM reels
    `);
    return Response.json({ reels: rows, stats: stats[0] });
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
      title?: string;
      caption?: string;
      hashtags?: string[];
      platform?: string;
      video_url?: string;
      thumbnail_url?: string;
      duration_seconds?: number;
      audio_name?: string;
      scheduled_at?: string;
      video_project_id?: string;
    };

    const { rows } = await pool.query(`
      INSERT INTO reels (title, caption, hashtags, platform, video_url, thumbnail_url, duration_seconds, audio_name, scheduled_at, video_project_id, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, CASE WHEN $9::text IS NOT NULL THEN 'scheduled' ELSE 'draft' END)
      RETURNING *
    `, [
      body.title || 'Untitled Reel',
      body.caption || '',
      body.hashtags || [],
      body.platform || 'instagram',
      body.video_url || null,
      body.thumbnail_url || null,
      body.duration_seconds || null,
      body.audio_name || null,
      body.scheduled_at || null,
      body.video_project_id || null,
    ]);
    return Response.json({ reel: rows[0] }, { status: 201 });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
