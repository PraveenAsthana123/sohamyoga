import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureSchema() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS youtube_videos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      video_id TEXT UNIQUE NOT NULL,
      title TEXT,
      description TEXT,
      channel_id TEXT,
      channel_title TEXT,
      thumbnail_url TEXT,
      published_at TEXT,
      duration_iso TEXT,
      duration_seconds INT,
      view_count INT DEFAULT 0,
      like_count INT DEFAULT 0,
      comment_count INT DEFAULT 0,
      dislike_count INT DEFAULT 0,
      favorite_count INT DEFAULT 0,
      tags TEXT[],
      category_id TEXT,
      status TEXT DEFAULT 'public',
      video_type TEXT DEFAULT 'video',
      transcript_fetched BOOLEAN DEFAULT false,
      synced_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS youtube_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      comment_id TEXT UNIQUE NOT NULL,
      video_id TEXT NOT NULL,
      author_name TEXT,
      author_channel_id TEXT,
      text TEXT,
      like_count INT DEFAULT 0,
      reply_count INT DEFAULT 0,
      is_top_comment BOOLEAN DEFAULT false,
      published_at TEXT,
      sentiment TEXT,
      is_responded BOOLEAN DEFAULT false,
      response_text TEXT,
      scraped_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS youtube_channel_stats (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      channel_id TEXT,
      subscriber_count INT,
      view_count BIGINT,
      video_count INT,
      recorded_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

async function seedIfEmpty() {
  const pool = getPool();

  const { rows: vids } = await pool.query('SELECT COUNT(*)::int AS cnt FROM youtube_videos');
  if (vids[0].cnt === 0) {
    await pool.query(`
      INSERT INTO youtube_videos (video_id, title, description, channel_id, channel_title, thumbnail_url, published_at, duration_iso, duration_seconds, view_count, like_count, comment_count, status, video_type) VALUES
      ('yt_vid_001', 'Morning Yoga Flow for Beginners | 30 Minutes Full Body', 'Start your day with this energizing morning yoga flow suitable for all levels.', 'UCsohamyoga001', 'Soham Yoga Studio', 'https://picsum.photos/seed/yt1/320/180', '2026-09-10T08:00:00Z', 'PT30M15S', 1815, 18400, 920, 87, 'public', 'video'),
      ('yt_vid_002', 'Warrior III Pose Tutorial — Perfect Your Balance', 'Step-by-step breakdown of Warrior III with modifications for beginners.', 'UCsohamyoga001', 'Soham Yoga Studio', 'https://picsum.photos/seed/yt2/320/180', '2026-09-07T14:00:00Z', 'PT12M42S', 762, 9200, 480, 43, 'public', 'video'),
      ('yt_vid_003', '5-Minute Desk Yoga #Shorts', 'Quick office yoga stretch — do this every hour at your desk!', 'UCsohamyoga001', 'Soham Yoga Studio', 'https://picsum.photos/seed/yt3/320/180', '2026-09-05T12:00:00Z', 'PT0M58S', 58, 42000, 2100, 156, 'public', 'short'),
      ('yt_vid_004', 'Breathwork Masterclass: Box Breathing + 4-7-8 Technique', 'Learn two powerful breathwork techniques for stress and sleep improvement.', 'UCsohamyoga001', 'Soham Yoga Studio', 'https://picsum.photos/seed/yt4/320/180', '2026-09-02T10:00:00Z', 'PT24M08S', 1448, 7800, 390, 62, 'public', 'video'),
      ('yt_vid_005', 'Yin Yoga for Deep Relaxation | Evening Practice', 'Slow-paced yin yoga targeting deep connective tissue — perfect before sleep.', 'UCsohamyoga001', 'Soham Yoga Studio', 'https://picsum.photos/seed/yt5/320/180', '2026-08-28T20:00:00Z', 'PT45M00S', 2700, 12100, 610, 74, 'public', 'video'),
      ('yt_vid_006', 'Yoga for Anxiety #Shorts', 'Three poses that calm your nervous system in under 60 seconds.', 'UCsohamyoga001', 'Soham Yoga Studio', 'https://picsum.photos/seed/yt6/320/180', '2026-08-25T15:00:00Z', 'PT0M52S', 52, 31000, 1840, 118, 'public', 'short'),
      ('yt_vid_007', 'Sun Salutation A & B — Complete Guide for All Levels', 'Master the foundation of Ashtanga yoga with this detailed breakdown.', 'UCsohamyoga001', 'Soham Yoga Studio', 'https://picsum.photos/seed/yt7/320/180', '2026-08-20T09:00:00Z', 'PT18M33S', 1113, 15300, 780, 95, 'public', 'video'),
      ('yt_vid_008', 'Live Yoga Class Recording — Weekend Workshop Highlight', 'Full recording of our September weekend workshop on restorative yoga.', 'UCsohamyoga001', 'Soham Yoga Studio', 'https://picsum.photos/seed/yt8/320/180', '2026-08-15T11:00:00Z', 'PT1H12M00S', 4320, 5600, 280, 38, 'public', 'live')
      ON CONFLICT (video_id) DO NOTHING
    `);
  }

  const { rows: comments } = await pool.query('SELECT COUNT(*)::int AS cnt FROM youtube_comments');
  if (comments[0].cnt === 0) {
    await pool.query(`
      INSERT INTO youtube_comments (comment_id, video_id, author_name, author_channel_id, text, like_count, reply_count, is_top_comment, published_at, sentiment) VALUES
      ('cmt_001', 'yt_vid_001', 'Anna Liu', 'UC_anna001', 'This is exactly what I needed! Starting my mornings with this routine has been incredible. Thank you!', 48, 3, true, '2026-09-11T07:30:00Z', 'positive'),
      ('cmt_002', 'yt_vid_001', 'MindfulMike', 'UC_mike002', 'Best beginner yoga video on YouTube. Clear instructions, great pacing, and the modifications really help.', 31, 1, false, '2026-09-11T09:00:00Z', 'positive'),
      ('cmt_003', 'yt_vid_001', 'SarahFitness', 'UC_sarah003', 'Could you make a version for people with knee issues? I have to modify some poses.', 12, 2, false, '2026-09-12T08:00:00Z', 'neutral'),
      ('cmt_004', 'yt_vid_002', 'YogaJourney99', 'UC_yj099', 'Finally understand Warrior III! Your cue about the hip alignment changed everything for me.', 67, 5, true, '2026-09-08T10:00:00Z', 'positive'),
      ('cmt_005', 'yt_vid_002', 'Tom L.', 'UC_tom004', 'I keep falling out of this pose. Is it normal to struggle for months?', 8, 4, false, '2026-09-08T14:00:00Z', 'neutral'),
      ('cmt_006', 'yt_vid_003', 'OfficeDeskYoga', 'UC_office005', 'Shared this with my entire office. Everyone loves it! More shorts please!', 120, 2, true, '2026-09-06T11:00:00Z', 'positive'),
      ('cmt_007', 'yt_vid_004', 'SleepBetter2026', 'UC_sleep006', 'The 4-7-8 technique knocked me out in 5 minutes last night. Incredible.', 89, 6, true, '2026-09-03T22:00:00Z', 'positive'),
      ('cmt_008', 'yt_vid_004', 'BreathworkFan', 'UC_bwf007', 'Please make a longer breathwork session! This was too short.', 23, 1, false, '2026-09-04T08:00:00Z', 'neutral'),
      ('cmt_009', 'yt_vid_005', 'NightOwl123', 'UC_no123', 'Did this before bed and slept 9 hours straight. Best video ever!', 156, 8, true, '2026-08-30T23:00:00Z', 'positive'),
      ('cmt_010', 'yt_vid_005', 'ChronicPainWarrior', 'UC_cpw008', 'The hip opener at 28 minutes was a bit too intense for me. Any gentler alternatives?', 9, 3, false, '2026-09-01T10:00:00Z', 'negative'),
      ('cmt_011', 'yt_vid_006', 'AnxietyAwareness', 'UC_aa009', 'Bookmarked this for panic attacks. Three poses in 52 seconds — perfect.', 78, 4, true, '2026-08-26T16:00:00Z', 'positive'),
      ('cmt_012', 'yt_vid_007', 'AshtangaStudent', 'UC_ash010', 'The breakdown of the transitions is so clear. Other videos skip the details you actually cover here.', 42, 2, false, '2026-08-22T09:00:00Z', 'positive')
      ON CONFLICT (comment_id) DO NOTHING
    `);
  }

  const { rows: stats } = await pool.query('SELECT COUNT(*)::int AS cnt FROM youtube_channel_stats');
  if (stats[0].cnt === 0) {
    await pool.query(`
      INSERT INTO youtube_channel_stats (channel_id, subscriber_count, view_count, video_count)
      VALUES ('UCsohamyoga001', 12400, 141400, 8)
    `);
  }
}

async function tryLiveFetch() {
  const key = process.env.YOUTUBE_API_KEY;
  const channelId = process.env.YOUTUBE_CHANNEL_ID;
  if (!key || !channelId) return null;

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${key}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) return res.json();
  } catch { /* fallback */ }
  return null;
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const pool = getPool();
    await ensureSchema();
    await seedIfEmpty();

    const [videos, comments, channelStats] = await Promise.all([
      pool.query('SELECT * FROM youtube_videos ORDER BY view_count DESC LIMIT 50'),
      pool.query('SELECT * FROM youtube_comments ORDER BY scraped_at DESC LIMIT 100'),
      pool.query('SELECT * FROM youtube_channel_stats ORDER BY recorded_at DESC LIMIT 1'),
    ]);

    const liveChannel = await tryLiveFetch();
    const channel = channelStats.rows[0] || {};

    // Top videos
    const topVideos = [...videos.rows].sort((a, b) => b.view_count - a.view_count).slice(0, 3);

    // Engagement rate per video
    const videosWithEngagement = videos.rows.map((v: Record<string, unknown>) => ({
      ...v,
      engagementRate: v.view_count
        ? (((Number(v.like_count) + Number(v.comment_count)) / Number(v.view_count)) * 100).toFixed(2)
        : '0.00',
    }));

    const totalViews = videos.rows.reduce((s: number, v: Record<string, unknown>) => s + (Number(v.view_count) || 0), 0);

    return Response.json({
      demo: !process.env.YOUTUBE_API_KEY,
      apiKeySet: Boolean(process.env.YOUTUBE_API_KEY),
      oauthSet: Boolean(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_REFRESH_TOKEN),
      channel: {
        ...channel,
        ...(liveChannel?.items?.[0]?.statistics || {}),
      },
      videos: videosWithEngagement,
      comments: comments.rows,
      topVideos,
      kpi: {
        totalVideos: videos.rows.length,
        totalViews,
        totalSubscribers: channel.subscriber_count || 0,
        totalLikes: videos.rows.reduce((s: number, v: Record<string, unknown>) => s + (Number(v.like_count) || 0), 0),
        avgEngagementRate: totalViews > 0
          ? (
              videos.rows.reduce(
                (s: number, v: Record<string, unknown>) =>
                  s + ((Number(v.like_count) + Number(v.comment_count)) / Math.max(Number(v.view_count), 1)) * 100,
                0
              ) / videos.rows.length
            ).toFixed(2)
          : '0.00',
        shorts: videos.rows.filter((v: Record<string, unknown>) => v.video_type === 'short').length,
      },
    });
  } catch (err) {
    console.error('[youtube-integration GET]', err);
    return Response.json({ error: 'Failed to load YouTube data' }, { status: 500 });
  }
}
