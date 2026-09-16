import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';
import { type PoolClient } from 'pg';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROVISION_SQL = `
CREATE TABLE IF NOT EXISTS youtube_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id TEXT NOT NULL UNIQUE,
  video_title TEXT,
  channel_name TEXT,
  channel_id TEXT,
  duration_seconds INT,
  published_at TEXT,
  thumbnail_url TEXT,
  video_url TEXT GENERATED ALWAYS AS ('https://www.youtube.com/watch?v=' || video_id) STORED,
  language TEXT DEFAULT 'en',
  transcript_raw TEXT,
  transcript_srt TEXT,
  word_count INT,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  ai_summary TEXT,
  ai_key_topics TEXT[],
  ai_sentiment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS youtube_transcript_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id UUID REFERENCES youtube_transcripts(id) ON DELETE CASCADE,
  start_seconds NUMERIC(10,3),
  duration_seconds NUMERIC(10,3),
  text TEXT,
  seq_num INT
);
`;

const SEED_SQL = `
INSERT INTO youtube_transcripts (video_id, video_title, channel_name, channel_id, duration_seconds, published_at, thumbnail_url, language, transcript_raw, transcript_srt, word_count, status, ai_summary, ai_key_topics, ai_sentiment)
VALUES
(
  'dQw4w9WgXcQ',
  'Digital Marketing Mastery: SEO, Social Media & Content Strategy',
  'Marketing Academy Pro',
  'UCmarketing001',
  1847,
  '2024-03-15',
  'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
  'en',
  'Welcome to Digital Marketing Mastery. In this comprehensive video we will cover everything you need to know about modern digital marketing strategies. First let us talk about SEO. Search engine optimization is the cornerstone of any successful online marketing campaign. When you optimize your content for search engines you increase your visibility and drive organic traffic to your website. The key elements of SEO include keyword research on-page optimization technical SEO and link building. Next we will discuss social media marketing. Platforms like Instagram Facebook LinkedIn and TikTok offer incredible opportunities to reach your target audience. Content marketing is another powerful strategy. By creating valuable informative content you establish your brand as an authority in your niche. Email marketing remains one of the highest ROI channels available to marketers today. Finally paid advertising through Google Ads and social media platforms can accelerate your growth significantly.',
  '1
00:00:01,000 --> 00:00:05,000
Welcome to Digital Marketing Mastery.

2
00:00:05,000 --> 00:00:10,000
In this comprehensive video we will cover everything you need to know.',
  142,
  'done',
  '• Comprehensive overview of digital marketing strategies including SEO, social media, and content marketing\n• Email marketing highlighted as highest ROI channel for modern marketers\n• Paid advertising through Google Ads accelerates growth significantly',
  ARRAY['SEO', 'Digital Marketing', 'Social Media', 'Content Strategy', 'Email Marketing'],
  'positive'
),
(
  'yoga_tutorial_001',
  'Morning Yoga Flow for Beginners: 20-Minute Full Body Stretch',
  'SohamYoga Official',
  'UCsohamyoga',
  1234,
  '2024-06-22',
  'https://img.youtube.com/vi/yoga_tutorial_001/maxresdefault.jpg',
  'en',
  'Good morning and welcome to SohamYoga. I am so glad you have decided to start your day with this gentle morning flow. Begin by finding a comfortable seated position on your mat. Close your eyes and take three deep breaths. Feel the earth beneath you grounding your energy. Now slowly raise your arms above your head as you inhale. As you exhale bring your hands to your heart center in anjali mudra or prayer position. We will begin our flow with a gentle cat-cow sequence. Come to all fours on your hands and knees. Make sure your wrists are directly under your shoulders and your knees under your hips. As you inhale drop your belly and lift your gaze for cow pose. As you exhale round your spine toward the ceiling for cat pose. Continue this movement for five breath cycles. Next we will flow into downward facing dog. Tuck your toes and lift your hips high. Press firmly through your palms and lengthen your spine. This pose energizes the entire body and is wonderful for stretching the hamstrings and calves.',
  '1
00:00:00,500 --> 00:00:04,000
Good morning and welcome to SohamYoga.

2
00:00:04,000 --> 00:00:09,000
Begin by finding a comfortable seated position on your mat.',
  163,
  'done',
  '• Guided 20-minute morning yoga flow suitable for beginners of all levels\n• Focuses on grounding, breathing, and gentle stretching to energize the body\n• Covers cat-cow sequence and downward facing dog as foundational poses',
  ARRAY['Yoga', 'Morning Flow', 'Beginners', 'Breathing', 'Stretching'],
  'positive'
),
(
  'affiliate_mktg_2024',
  'Affiliate Marketing Strategy 2024: How to Build Passive Income',
  'Revenue Builders Network',
  'UCrevbuilders',
  2156,
  '2024-08-10',
  'https://img.youtube.com/vi/affiliate_mktg_2024/maxresdefault.jpg',
  'en',
  'In this video I am going to show you exactly how I built a six figure affiliate marketing business from scratch. Affiliate marketing is the process of earning a commission by promoting other people products or services. You find a product you like promote it to others and earn a piece of the profit for each sale you make. The first step is choosing the right niche. You want to pick something that you are passionate about and that has commercial intent. Popular niches include health and wellness technology finance and lifestyle. Next you need to build your platform. This could be a blog YouTube channel social media presence or email list. The key is to consistently create valuable content that solves your audience problems. Once you have an audience you can start joining affiliate programs. Amazon Associates Commission Junction and ShareASale are great starting points. Track your performance metrics including click through rates conversion rates and earnings per click. Always disclose your affiliate relationships to maintain trust with your audience.',
  '1
00:00:01,000 --> 00:00:05,500
In this video I am going to show you exactly how I built a six figure affiliate marketing business.

2
00:00:05,500 --> 00:00:11,000
Affiliate marketing is the process of earning a commission by promoting other people products.',
  171,
  'done',
  '• Step-by-step guide to building affiliate marketing income from niche selection to platform building\n• Key platforms covered: Amazon Associates, Commission Junction, and ShareASale\n• Emphasizes tracking performance metrics and maintaining audience trust through disclosure',
  ARRAY['Affiliate Marketing', 'Passive Income', 'Niche Selection', 'Commission', 'Monetization'],
  'positive'
)
ON CONFLICT (video_id) DO NOTHING;
`;

async function provision(client: PoolClient) {
  await client.query(PROVISION_SQL);
  await client.query(SEED_SQL);
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await provision(client);

    const result = await client.query(`
      SELECT id, video_id, video_title, channel_name, channel_id, duration_seconds,
             published_at, thumbnail_url, video_url, language, word_count, status,
             error_message, ai_summary, ai_key_topics, ai_sentiment, created_at, updated_at
      FROM youtube_transcripts
      ORDER BY created_at DESC
    `);

    return Response.json({ transcripts: result.rows });
  } catch (err) {
    console.error('[youtube-transcript GET]', err);
    return Response.json({ error: 'Failed to fetch transcripts.' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await provision(client);

    const body = await req.json().catch(() => null) as { videoId?: string; language?: string } | null;
    if (!body?.videoId?.trim()) {
      return Response.json({ error: 'videoId is required.' }, { status: 400 });
    }
    const videoId = body.videoId.trim();
    const language = body.language?.trim() || 'en';

    // Insert as pending (fetch route will actually do the work)
    const result = await client.query(`
      INSERT INTO youtube_transcripts (video_id, language, status)
      VALUES ($1, $2, 'pending')
      ON CONFLICT (video_id) DO UPDATE SET language = EXCLUDED.language, status = 'pending', updated_at = NOW()
      RETURNING id, video_id, status, created_at
    `, [videoId, language]);

    return Response.json({ transcript: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error('[youtube-transcript POST]', err);
    return Response.json({ error: 'Failed to queue transcript job.' }, { status: 500 });
  } finally {
    client.release();
  }
}
