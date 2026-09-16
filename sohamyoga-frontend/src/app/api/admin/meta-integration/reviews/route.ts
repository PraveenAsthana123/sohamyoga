import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureSchema() {
  const pool = getPool();
  await pool.query(`
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

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const pool = getPool();
    await ensureSchema();

    const { searchParams } = new URL(req.url);
    const rating = searchParams.get('rating');
    const sentiment = searchParams.get('sentiment');
    const responded = searchParams.get('responded');

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (rating) {
      conditions.push(`rating = $${values.length + 1}`);
      values.push(Number(rating));
    }
    if (sentiment && sentiment !== 'all') {
      conditions.push(`sentiment = $${values.length + 1}`);
      values.push(sentiment);
    }
    if (responded === 'false') {
      conditions.push('response_text IS NULL');
    } else if (responded === 'true') {
      conditions.push('response_text IS NOT NULL');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT * FROM meta_reviews ${where} ORDER BY scraped_at DESC`,
      values
    );

    // Rating distribution
    const ratingDist = await pool.query(
      `SELECT rating, COUNT(*)::int AS cnt FROM meta_reviews GROUP BY rating ORDER BY rating DESC`
    );
    const totalReviews = rows.length;
    const avgRating = totalReviews > 0
      ? (rows.reduce((s: number, r: Record<string, unknown>) => s + (Number(r.rating) || 0), 0) / totalReviews).toFixed(1)
      : '0.0';

    return Response.json({
      reviews: rows,
      summary: {
        total: totalReviews,
        avgRating: Number(avgRating),
        unresponded: rows.filter((r: Record<string, unknown>) => !r.response_text).length,
        ratingDistribution: ratingDist.rows,
      },
      demo: !process.env.META_PAGE_ACCESS_TOKEN,
    });
  } catch (err) {
    console.error('[meta-reviews GET]', err);
    return Response.json({ error: 'Failed to load reviews' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const pool = getPool();
    await ensureSchema();

    const body = await req.json() as { review_id: string; response_text: string };

    if (!body.review_id || !body.response_text) {
      return Response.json({ error: 'review_id and response_text are required' }, { status: 400 });
    }

    const token = process.env.META_PAGE_ACCESS_TOKEN;
    let metaResult: Record<string, unknown> | null = null;
    let warning: string | undefined;

    if (token) {
      try {
        const metaRes = await fetch(
          `https://graph.facebook.com/v18.0/${body.review_id}/comments?message=${encodeURIComponent(body.response_text)}&access_token=${token}`,
          { method: 'POST', signal: AbortSignal.timeout(10000) }
        );
        if (metaRes.ok) {
          metaResult = await metaRes.json() as Record<string, unknown>;
        } else {
          const errData = await metaRes.json() as Record<string, unknown>;
          warning = `Meta API returned error: ${JSON.stringify(errData)}`;
        }
      } catch (fetchErr) {
        console.error('[meta-reviews reply]', fetchErr);
        warning = 'Could not post reply to Meta — response saved locally.';
      }
    } else {
      warning = 'No Meta page token configured — response saved locally only.';
    }

    const { rows } = await pool.query(
      `UPDATE meta_reviews
       SET response_text = $1, responded_at = NOW()
       WHERE review_id = $2
       RETURNING *`,
      [body.response_text, body.review_id]
    );

    if (rows.length === 0) {
      return Response.json({ error: 'Review not found' }, { status: 404 });
    }

    return Response.json({ review: rows[0], metaResult, warning });
  } catch (err) {
    console.error('[meta-reviews POST]', err);
    return Response.json({ error: 'Failed to post review response' }, { status: 500 });
  }
}
