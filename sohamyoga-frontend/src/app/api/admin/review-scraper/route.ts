import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';
import type { PoolClient } from 'pg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureSchema(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS review_scrape_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      business_name TEXT NOT NULL,
      business_url TEXT,
      platform TEXT NOT NULL,
      place_id TEXT,
      status TEXT DEFAULT 'idle',
      last_run_at TIMESTAMPTZ,
      reviews_found INT DEFAULT 0,
      schedule TEXT DEFAULT 'manual',
      is_competitor BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS scraped_reviews (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id UUID REFERENCES review_scrape_jobs(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      reviewer_name TEXT,
      star_rating NUMERIC(2,1),
      review_text TEXT,
      review_date TEXT,
      review_url TEXT,
      sentiment TEXT,
      sentiment_score NUMERIC(4,3),
      ai_summary TEXT,
      is_responded BOOLEAN DEFAULT false,
      response_text TEXT,
      is_mock BOOLEAN DEFAULT false,
      scraped_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Seed if empty
  const { rows: jobRows } = await client.query(`SELECT COUNT(*) AS cnt FROM review_scrape_jobs`);
  if (parseInt(jobRows[0].cnt, 10) === 0) {
    const { rows: seeded } = await client.query(`
      INSERT INTO review_scrape_jobs (business_name, business_url, platform, place_id, status, reviews_found, schedule)
      VALUES
        ('Soham Yoga Studio', 'https://maps.google.com/?cid=1234567890', 'google', 'ChIJN1t_tDeuEmsRUsoyG83frY4', 'done', 4, 'weekly'),
        ('Soham Yoga Studio Yelp', 'https://www.yelp.com/biz/soham-yoga-studio', 'yelp', NULL, 'done', 4, 'daily')
      RETURNING id, platform
    `);

    if (seeded.length === 2) {
      const googleJobId = seeded.find((r: { id: string; platform: string }) => r.platform === 'google')?.id;
      const yelpJobId = seeded.find((r: { id: string; platform: string }) => r.platform === 'yelp')?.id;

      if (googleJobId) {
        await client.query(`
          INSERT INTO scraped_reviews (job_id, platform, reviewer_name, star_rating, review_text, review_date, sentiment, sentiment_score, is_mock)
          VALUES
            ($1, 'google', 'Alice K.', 5.0, 'Absolutely transformative classes! The instructors are incredibly knowledgeable and the studio atmosphere is so peaceful. I have been coming for 3 months and feel amazing.', '2026-08-15', 'positive', 0.95, false),
            ($1, 'google', 'Bob M.', 4.0, 'Great classes and friendly staff. The morning sessions fill up quickly so book ahead. The meditation add-ons are a nice touch.', '2026-08-22', 'positive', 0.82, false),
            ($1, 'google', 'Carol T.', 3.0, 'Classes are decent but the parking situation is a bit tricky. The yoga instruction itself is good quality though.', '2026-09-01', 'neutral', 0.51, false),
            ($1, 'google', 'David R.', 5.0, 'Best yoga studio in the city! The hot yoga classes are challenging but so rewarding. Highly recommend the weekend workshops.', '2026-09-10', 'positive', 0.97, false)
        `, [googleJobId]);
      }

      if (yelpJobId) {
        await client.query(`
          INSERT INTO scraped_reviews (job_id, platform, reviewer_name, star_rating, review_text, review_date, sentiment, sentiment_score, is_mock)
          VALUES
            ($1, 'yelp', 'Emma S.', 5.0, 'Wonderful experience every single time. The teachers really know their stuff and the studio is always immaculate. Love the community here!', '2026-08-10', 'positive', 0.93, false),
            ($1, 'yelp', 'Frank L.', 2.0, 'Felt a bit rushed during the class. The instructor moved too fast for beginners. Hopefully they improve the pacing for new students.', '2026-08-18', 'negative', 0.18, false),
            ($1, 'yelp', 'Grace W.', 4.0, 'Really enjoy the variety of classes offered. The prenatal yoga was perfect for me. Staff are very accommodating and helpful.', '2026-09-05', 'positive', 0.88, false),
            ($1, 'yelp', 'Henry P.', 1.0, 'Cancelled my class 2 hours before with no refund. Very disappointing cancellation policy. Would not recommend based on this experience.', '2026-09-12', 'negative', 0.04, false)
        `, [yelpJobId]);
      }
    }
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureSchema(client);

    const { searchParams } = new URL(req.url);
    const platform = searchParams.get('platform');
    const sentiment = searchParams.get('sentiment');
    const rating = searchParams.get('rating');
    const jobId = searchParams.get('job_id');
    const isCompetitor = searchParams.get('is_competitor');

    const { rows: jobs } = await client.query(
      `SELECT * FROM review_scrape_jobs ORDER BY created_at DESC`
    );

    const conditions: string[] = [];
    const params: unknown[] = [];
    let pIdx = 1;

    if (platform) { conditions.push(`r.platform = $${pIdx++}`); params.push(platform); }
    if (sentiment) { conditions.push(`r.sentiment = $${pIdx++}`); params.push(sentiment); }
    if (rating) { conditions.push(`r.star_rating = $${pIdx++}`); params.push(parseFloat(rating)); }
    if (jobId) { conditions.push(`r.job_id = $${pIdx++}`); params.push(jobId); }
    if (isCompetitor !== null) {
      conditions.push(`j.is_competitor = $${pIdx++}`);
      params.push(isCompetitor === 'true');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows: reviews } = await client.query(
      `SELECT r.*, j.business_name, j.is_competitor
       FROM scraped_reviews r
       JOIN review_scrape_jobs j ON j.id = r.job_id
       ${where}
       ORDER BY r.scraped_at DESC
       LIMIT 500`,
      params
    );

    return Response.json({ jobs, reviews });
  } catch (err) {
    console.error('[review-scraper GET]', err);
    return Response.json({ error: 'Failed to load review scraper data.' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { business_name, platform, business_url, place_id, schedule, is_competitor } = body;

  if (!business_name || typeof business_name !== 'string' || !business_name.trim()) {
    return Response.json({ error: 'business_name is required.' }, { status: 400 });
  }
  const PLATFORMS = ['google', 'yelp', 'tripadvisor', 'facebook', 'trustpilot', 'g2', 'capterra'];
  if (!platform || !PLATFORMS.includes(platform as string)) {
    return Response.json({ error: `platform must be one of: ${PLATFORMS.join(', ')}` }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureSchema(client);

    const { rows } = await client.query(
      `INSERT INTO review_scrape_jobs (business_name, business_url, platform, place_id, schedule, is_competitor)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        (business_name as string).trim(),
        business_url || null,
        platform,
        place_id || null,
        schedule && ['manual', 'daily', 'weekly'].includes(schedule as string) ? schedule : 'manual',
        is_competitor === true,
      ]
    );

    return Response.json({ job: rows[0] }, { status: 201 });
  } catch (err) {
    console.error('[review-scraper POST]', err);
    return Response.json({ error: 'Failed to create scrape job.' }, { status: 500 });
  } finally {
    client.release();
  }
}
