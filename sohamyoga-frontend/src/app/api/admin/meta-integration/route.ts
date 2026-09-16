import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureSchema() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS meta_pages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      page_id TEXT UNIQUE NOT NULL,
      page_name TEXT,
      page_category TEXT,
      access_token TEXT,
      instagram_business_id TEXT,
      status TEXT DEFAULT 'connected',
      followers INT DEFAULT 0,
      likes INT DEFAULT 0,
      last_synced_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS meta_posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      page_id TEXT,
      post_id TEXT UNIQUE,
      post_type TEXT,
      message TEXT,
      full_picture TEXT,
      permalink_url TEXT,
      platform TEXT DEFAULT 'facebook',
      status TEXT DEFAULT 'published',
      likes INT DEFAULT 0,
      comments INT DEFAULT 0,
      shares INT DEFAULT 0,
      reach INT DEFAULT 0,
      impressions INT DEFAULT 0,
      video_views INT DEFAULT 0,
      created_time TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS meta_ad_campaigns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id TEXT UNIQUE,
      campaign_name TEXT NOT NULL,
      objective TEXT,
      status TEXT DEFAULT 'ACTIVE',
      daily_budget NUMERIC(10,2),
      lifetime_budget NUMERIC(10,2),
      spend NUMERIC(12,2) DEFAULT 0,
      impressions INT DEFAULT 0,
      clicks INT DEFAULT 0,
      ctr NUMERIC(6,4),
      cpm NUMERIC(8,2),
      cpc NUMERIC(8,2),
      conversions INT DEFAULT 0,
      cost_per_conversion NUMERIC(10,2),
      roas NUMERIC(6,3),
      start_date DATE,
      end_date DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS meta_reviews (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      review_id TEXT UNIQUE,
      page_id TEXT,
      reviewer_name TEXT,
      reviewer_id TEXT,
      rating INT,
      review_text TEXT,
      created_time TEXT,
      platform TEXT DEFAULT 'facebook',
      sentiment TEXT,
      response_text TEXT,
      responded_at TIMESTAMPTZ,
      scraped_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

async function seedIfEmpty() {
  const pool = getPool();

  const { rows: pages } = await pool.query('SELECT COUNT(*)::int AS cnt FROM meta_pages');
  if (pages[0].cnt === 0) {
    await pool.query(`
      INSERT INTO meta_pages (page_id, page_name, page_category, status, followers, likes, last_synced_at)
      VALUES ('123456789012345', 'Soham Yoga Studio', 'Health/Wellness', 'connected', 4820, 4310, NOW() - INTERVAL '2 hours')
      ON CONFLICT (page_id) DO NOTHING
    `);
  }

  const { rows: posts } = await pool.query('SELECT COUNT(*)::int AS cnt FROM meta_posts');
  if (posts[0].cnt === 0) {
    await pool.query(`
      INSERT INTO meta_posts (page_id, post_id, post_type, message, platform, status, likes, comments, shares, reach, impressions, created_time) VALUES
      ('123456789012345', 'post_001', 'feed', 'Morning yoga flow to start your day with intention and peace. Join us for our 6am sunrise class! 🧘', 'facebook', 'published', 142, 18, 23, 3200, 5100, '2026-09-14T06:00:00Z'),
      ('123456789012345', 'post_002', 'reel', 'Watch our instructor demo the perfect Warrior III pose. Save this for your next practice!', 'instagram', 'published', 380, 45, 67, 8900, 14200, '2026-09-13T14:00:00Z'),
      ('123456789012345', 'post_003', 'feed', 'New class schedule is live! Check our website for all autumn sessions including yin yoga and meditation.', 'facebook', 'published', 89, 12, 15, 2100, 3800, '2026-09-12T10:00:00Z'),
      ('123456789012345', 'post_004', 'story', 'Weekend workshop early bird pricing ends Friday — only 5 spots left!', 'instagram', 'published', 210, 8, 0, 1800, 2200, '2026-09-11T18:00:00Z'),
      ('123456789012345', 'post_005', 'feed', 'Breathwork session recording now available for members. Link in bio.', 'facebook', 'published', 67, 9, 11, 1400, 2600, '2026-09-10T12:00:00Z'),
      ('123456789012345', 'post_006', 'reel', '5-minute desk yoga for office workers — share with someone who needs this today!', 'instagram', 'published', 512, 73, 128, 22000, 38000, '2026-09-09T16:00:00Z')
      ON CONFLICT (post_id) DO NOTHING
    `);
  }

  const { rows: campaigns } = await pool.query('SELECT COUNT(*)::int AS cnt FROM meta_ad_campaigns');
  if (campaigns[0].cnt === 0) {
    await pool.query(`
      INSERT INTO meta_ad_campaigns (campaign_id, campaign_name, objective, status, daily_budget, lifetime_budget, spend, impressions, clicks, ctr, cpm, cpc, conversions, cost_per_conversion, roas, start_date, end_date) VALUES
      ('camp_001', 'Autumn Class Enrollment', 'LEADS', 'ACTIVE', 25.00, NULL, 312.50, 48200, 1840, 0.0382, 6.48, 0.17, 42, 7.44, 3.21, '2026-09-01', '2026-09-30'),
      ('camp_002', 'Brand Awareness – Yoga Studio', 'AWARENESS', 'ACTIVE', 15.00, NULL, 198.00, 72000, 980, 0.0136, 2.75, 0.20, 0, NULL, NULL, '2026-09-01', '2026-09-30'),
      ('camp_003', 'Weekend Workshop Sales', 'SALES', 'PAUSED', 50.00, 500.00, 487.20, 31000, 2100, 0.0677, 15.72, 0.23, 18, 27.07, 4.80, '2026-08-15', '2026-09-15'),
      ('camp_004', 'App Download – Yoga at Home', 'APP_PROMOTION', 'ACTIVE', 20.00, NULL, 156.80, 28400, 1420, 0.0500, 5.52, 0.11, 67, 2.34, 5.92, '2026-09-08', '2026-09-30')
      ON CONFLICT (campaign_id) DO NOTHING
    `);
  }

  const { rows: reviews } = await pool.query('SELECT COUNT(*)::int AS cnt FROM meta_reviews');
  if (reviews[0].cnt === 0) {
    await pool.query(`
      INSERT INTO meta_reviews (review_id, page_id, reviewer_name, reviewer_id, rating, review_text, created_time, platform, sentiment) VALUES
      ('rev_001', '123456789012345', 'Sarah M.', 'u_001', 5, 'Absolutely love this studio! The instructors are incredibly knowledgeable and the atmosphere is so calming. Best yoga in the city!', '2026-09-14T09:00:00Z', 'facebook', 'positive'),
      ('rev_002', '123456789012345', 'James T.', 'u_002', 5, 'I have been coming here for 6 months and it has transformed my wellbeing. Highly recommend to anyone looking to start their yoga journey.', '2026-09-12T14:30:00Z', 'facebook', 'positive'),
      ('rev_003', '123456789012345', 'Priya K.', 'u_003', 4, 'Great classes and wonderful community. Parking can be a bit tricky but worth it!', '2026-09-11T11:00:00Z', 'facebook', 'positive'),
      ('rev_004', '123456789012345', 'Michael R.', 'u_004', 5, 'The online classes are just as good as in-person. Very professional setup and clear instructions.', '2026-09-10T16:00:00Z', 'facebook', 'positive'),
      ('rev_005', '123456789012345', 'Linda H.', 'u_005', 3, 'Classes are good but booking system could be improved. Took a few tries to register online.', '2026-09-08T10:00:00Z', 'facebook', 'neutral'),
      ('rev_006', '123456789012345', 'David C.', 'u_006', 5, 'The breathwork workshop was life-changing. Cannot wait for the next one!', '2026-09-06T15:00:00Z', 'facebook', 'positive'),
      ('rev_007', '123456789012345', 'Emma W.', 'u_007', 2, 'Expected more variety in beginner classes. Only one time slot available on weekends which does not work for me.', '2026-09-04T12:00:00Z', 'facebook', 'negative'),
      ('rev_008', '123456789012345', 'Tom B.', 'u_008', 5, 'Found this place through Instagram and it exceeded expectations. Great instructors, clean space, welcoming community.', '2026-09-01T09:30:00Z', 'facebook', 'positive')
      ON CONFLICT (review_id) DO NOTHING
    `);
  }
}

async function tryLiveFetch(pageId: string, token: string) {
  const base = 'https://graph.facebook.com/v18.0';
  const results: Record<string, unknown> = {};
  try {
    const postsRes = await fetch(
      `${base}/${pageId}/posts?fields=id,message,full_picture,permalink_url,created_time,likes.summary(true),comments.summary(true),shares&access_token=${token}&limit=20`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (postsRes.ok) results.livePosts = await postsRes.json();
  } catch { /* live fetch failed, use seeded data */ }

  try {
    const reviewsRes = await fetch(
      `${base}/${pageId}/ratings?fields=reviewer,rating,review_text,created_time&access_token=${token}&limit=20`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (reviewsRes.ok) results.liveReviews = await reviewsRes.json();
  } catch { /* fallback to DB */ }

  return results;
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const pool = getPool();
    await ensureSchema();
    await seedIfEmpty();

    const [pages, posts, campaigns, reviews] = await Promise.all([
      pool.query('SELECT * FROM meta_pages ORDER BY created_at DESC'),
      pool.query('SELECT * FROM meta_posts ORDER BY created_at DESC LIMIT 50'),
      pool.query('SELECT * FROM meta_ad_campaigns ORDER BY created_at DESC'),
      pool.query('SELECT * FROM meta_reviews ORDER BY scraped_at DESC'),
    ]);

    const token = process.env.META_PAGE_ACCESS_TOKEN;
    const pageId = process.env.META_PAGE_ID || pages.rows[0]?.page_id;
    let liveData: Record<string, unknown> = {};
    let demo = true;

    if (token && pageId) {
      liveData = await tryLiveFetch(pageId, token);
      demo = false;
    }

    const totalReach = posts.rows.reduce((s: number, p: Record<string, unknown>) => s + (Number(p.reach) || 0), 0);
    const activeCampaigns = campaigns.rows.filter((c: Record<string, unknown>) => c.status === 'ACTIVE').length;
    const totalSpend = campaigns.rows.reduce((s: number, c: Record<string, unknown>) => s + (Number(c.spend) || 0), 0);
    const avgRating = reviews.rows.length
      ? (reviews.rows.reduce((s: number, r: Record<string, unknown>) => s + (Number(r.rating) || 0), 0) / reviews.rows.length).toFixed(1)
      : '0.0';
    const unresponded = reviews.rows.filter((r: Record<string, unknown>) => !r.response_text).length;

    return Response.json({
      demo,
      appId: process.env.FACEBOOK_APP_ID || '998353279926364',
      connected: Boolean(token && pageId),
      pages: pages.rows,
      posts: posts.rows,
      campaigns: campaigns.rows,
      reviews: reviews.rows,
      liveData,
      kpi: {
        totalPosts: posts.rows.length,
        totalReach,
        activeCampaigns,
        totalSpend: Number(totalSpend.toFixed(2)),
        avgRating: Number(avgRating),
        unrespondedReviews: unresponded,
      },
    });
  } catch (err) {
    console.error('[meta-integration GET]', err);
    return Response.json({ error: 'Failed to load Meta integration data' }, { status: 500 });
  }
}
