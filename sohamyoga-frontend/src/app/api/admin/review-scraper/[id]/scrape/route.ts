import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';
import { OLLAMA_URL, OLLAMA_MODEL } from '@/lib/ollama';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RawReview {
  reviewer_name: string;
  star_rating: number;
  review_text: string;
  review_date: string;
  review_url: string | null;
  is_mock: boolean;
}

// ── Keyword-based sentiment fallback ──────────────────────────────────────────
function keywordSentiment(text: string): { sentiment: string; score: number } {
  const lower = text.toLowerCase();
  const positive = ['great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'best', 'perfect', 'highly recommend', 'outstanding', 'superb', 'brilliant', 'awesome', 'delightful', 'transformative'];
  const negative = ['terrible', 'awful', 'horrible', 'worst', 'hate', 'disappointing', 'poor', 'bad', 'waste', 'never again', 'refund', 'cancelled', 'rude', 'disappointed', 'disgusting'];
  let pos = 0;
  let neg = 0;
  for (const w of positive) if (lower.includes(w)) pos++;
  for (const w of negative) if (lower.includes(w)) neg++;
  if (pos > neg) return { sentiment: 'positive', score: Math.min(0.95, 0.55 + pos * 0.1) };
  if (neg > pos) return { sentiment: 'negative', score: Math.max(0.05, 0.45 - neg * 0.1) };
  return { sentiment: 'neutral', score: 0.5 };
}

// ── Ollama sentiment ──────────────────────────────────────────────────────────
async function ollamaSentiment(text: string): Promise<{ sentiment: string; score: number }> {
  try {
    const prompt = `Classify the sentiment of this review as positive, neutral, or negative and give a confidence score 0.0-1.0. Review: "${text.slice(0, 400)}". Respond ONLY in JSON like: {"sentiment":"positive","score":0.92}`;
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Ollama returned ${res.status}`);
    const data = await res.json() as { response?: string };
    const raw = data.response || '';
    const match = raw.match(/\{[^}]+\}/);
    if (!match) throw new Error('No JSON in Ollama response');
    const parsed = JSON.parse(match[0]) as { sentiment?: string; score?: number };
    const sentiment = ['positive', 'neutral', 'negative'].includes(parsed.sentiment || '') ? parsed.sentiment! : 'neutral';
    const score = typeof parsed.score === 'number' ? Math.max(0, Math.min(1, parsed.score)) : 0.5;
    return { sentiment, score };
  } catch {
    return keywordSentiment(text);
  }
}

// ── SerpAPI Google Maps Reviews ───────────────────────────────────────────────
async function scrapeGoogle(placeId: string): Promise<RawReview[]> {
  const key = process.env.SERPAPI_KEY;
  if (!key) throw new Error('SERPAPI_KEY not set');
  const url = `https://serpapi.com/search.json?engine=google_maps_reviews&place_id=${encodeURIComponent(placeId)}&api_key=${key}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`SerpAPI error: ${res.status}`);
  const data = await res.json() as { reviews?: Array<{ user?: { name?: string }; rating?: number; snippet?: string; date?: string; link?: string }> };
  return (data.reviews || []).slice(0, 10).map(r => ({
    reviewer_name: r.user?.name || 'Anonymous',
    star_rating: r.rating || 0,
    review_text: r.snippet || '',
    review_date: r.date || new Date().toISOString().split('T')[0],
    review_url: r.link || null,
    is_mock: false,
  }));
}

// ── Yelp HTML scrape ──────────────────────────────────────────────────────────
async function scrapeYelp(businessUrl: string): Promise<RawReview[]> {
  const res = await fetch(businessUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ReviewBot/1.0)' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Yelp fetch error: ${res.status}`);
  const html = await res.text();

  const reviews: RawReview[] = [];
  // Extract reviewer names
  const nameMatches = [...html.matchAll(/class="user-passport-info"[^>]*>[\s\S]*?<span[^>]*>([^<]{2,60})<\/span>/g)];
  // Extract ratings
  const ratingMatches = [...html.matchAll(/aria-label="(\d) star rating"/g)];
  // Extract review paragraphs
  const textMatches = [...html.matchAll(/<p[^>]*\bcomment\b[^>]*>([\s\S]*?)<\/p>/g)];
  // Extract dates
  const dateMatches = [...html.matchAll(/class="[^"]*arrange-unit[^"]*"[^>]*>[\s\S]*?(\d{1,2}\/\d{1,2}\/\d{4})/g)];

  const count = Math.max(ratingMatches.length, textMatches.length);
  for (let i = 0; i < Math.min(count, 8); i++) {
    const name = nameMatches[i]?.[1]?.trim() || `Yelp Reviewer ${i + 1}`;
    const rating = ratingMatches[i] ? parseInt(ratingMatches[i][1], 10) : 3;
    const rawText = textMatches[i]?.[1]?.replace(/<[^>]+>/g, '').trim() || '';
    if (!rawText) continue;
    reviews.push({
      reviewer_name: name,
      star_rating: rating,
      review_text: rawText.slice(0, 1000),
      review_date: dateMatches[i]?.[1] || new Date().toISOString().split('T')[0],
      review_url: businessUrl,
      is_mock: false,
    });
  }
  if (!reviews.length) throw new Error('No reviews found in Yelp HTML');
  return reviews;
}

// ── Trustpilot HTML scrape ────────────────────────────────────────────────────
async function scrapeTrustpilot(businessUrl: string): Promise<RawReview[]> {
  const res = await fetch(businessUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ReviewBot/1.0)' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Trustpilot fetch error: ${res.status}`);
  const html = await res.text();

  const reviews: RawReview[] = [];
  const reviewBlocks = [...html.matchAll(/data-service-review-card-paper[^>]*>([\s\S]*?)(?=data-service-review-card-paper|<\/section>)/g)];

  for (const block of reviewBlocks.slice(0, 8)) {
    const content = block[1];
    const nameM = content.match(/data-consumer-name[^>]*>([^<]{1,60})</);
    const ratingM = content.match(/data-service-review-rating[^>]*rating-([1-5])/);
    const textM = content.match(/<p[^>]*>([^<]{10,})<\/p>/);
    const dateM = content.match(/<time[^>]*datetime="([^"]+)"/);

    if (!textM) continue;
    reviews.push({
      reviewer_name: nameM?.[1]?.trim() || 'Trustpilot Reviewer',
      star_rating: ratingM ? parseInt(ratingM[1], 10) : 3,
      review_text: textM[1].trim().slice(0, 1000),
      review_date: dateM ? dateM[1].split('T')[0] : new Date().toISOString().split('T')[0],
      review_url: businessUrl,
      is_mock: false,
    });
  }
  if (!reviews.length) throw new Error('No reviews found in Trustpilot HTML');
  return reviews;
}

// ── Mock fallback ─────────────────────────────────────────────────────────────
function mockReviews(platform: string, businessName: string): RawReview[] {
  const today = new Date().toISOString().split('T')[0];
  return [
    {
      reviewer_name: 'Demo User A',
      star_rating: 5,
      review_text: `[DEMO] ${businessName} is absolutely fantastic! The classes are well-structured and the community is incredibly welcoming. Highly recommend to anyone interested.`,
      review_date: today,
      review_url: null,
      is_mock: true,
    },
    {
      reviewer_name: 'Demo User B',
      star_rating: 3,
      review_text: `[DEMO] Average experience at ${businessName}. The facility is nice but booking can be tricky. Instruction quality varies by instructor.`,
      review_date: today,
      review_url: null,
      is_mock: true,
    },
    {
      reviewer_name: 'Demo User C',
      star_rating: 1,
      review_text: `[DEMO] Disappointed with my experience at ${businessName}. The cancellation policy is strict and customer service could be more responsive.`,
      review_date: today,
      review_url: null,
      is_mock: true,
    },
  ].map(r => ({ ...r, platform } as RawReview));
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = params;
  const pool = getPool();
  const client = await pool.connect();
  try {
    // Ensure schema exists
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

    // Fetch job
    const { rows: jobRows } = await client.query(
      `SELECT * FROM review_scrape_jobs WHERE id = $1`,
      [id]
    );
    if (!jobRows.length) return Response.json({ error: 'Job not found.' }, { status: 404 });
    const job = jobRows[0] as { id: string; business_name: string; business_url: string | null; platform: string; place_id: string | null; status: string };

    // Mark running
    await client.query(
      `UPDATE review_scrape_jobs SET status = 'running' WHERE id = $1`,
      [id]
    );

    let rawReviews: RawReview[] = [];
    let warning: string | null = null;

    try {
      if (job.platform === 'google' && job.place_id) {
        rawReviews = await scrapeGoogle(job.place_id);
      } else if (job.platform === 'yelp' && job.business_url) {
        rawReviews = await scrapeYelp(job.business_url);
      } else if (job.platform === 'trustpilot' && job.business_url) {
        rawReviews = await scrapeTrustpilot(job.business_url);
      } else {
        throw new Error(`No scrape credentials or URL configured for platform: ${job.platform}`);
      }
    } catch (scrapeErr) {
      console.warn('[review-scraper scrape]', scrapeErr);
      rawReviews = mockReviews(job.platform, job.business_name);
      warning = `Real scrape failed (${(scrapeErr as Error).message}), showing demo data. Configure SERPAPI_KEY or a ScrapeOps key for live data.`;
    }

    // Run sentiment analysis on each review
    const enriched = await Promise.all(
      rawReviews.map(async (r) => {
        const { sentiment, score } = await ollamaSentiment(r.review_text);
        return { ...r, sentiment, sentiment_score: score };
      })
    );

    // Insert scraped reviews
    const insertedReviews = [];
    for (const r of enriched) {
      const { rows } = await client.query(
        `INSERT INTO scraped_reviews
           (job_id, platform, reviewer_name, star_rating, review_text, review_date, review_url, sentiment, sentiment_score, is_mock)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [id, job.platform, r.reviewer_name, r.star_rating, r.review_text, r.review_date, r.review_url ?? null, r.sentiment, r.sentiment_score, r.is_mock ?? false]
      );
      insertedReviews.push(rows[0]);
    }

    // Update job status
    const { rows: updatedJob } = await client.query(
      `UPDATE review_scrape_jobs
       SET status = 'done', last_run_at = NOW(), reviews_found = reviews_found + $2
       WHERE id = $1
       RETURNING *`,
      [id, enriched.length]
    );

    const response: Record<string, unknown> = {
      job: updatedJob[0],
      newReviews: enriched.length,
      reviews: insertedReviews,
    };
    if (warning) response.warning = warning;

    return Response.json(response);
  } catch (err) {
    console.error('[review-scraper/[id]/scrape POST]', err);
    // Try to reset status to error
    try {
      await client.query(`UPDATE review_scrape_jobs SET status = 'error' WHERE id = $1`, [id]);
    } catch { /* ignore */ }
    return Response.json({ error: 'Scrape failed.' }, { status: 500 });
  } finally {
    client.release();
  }
}
