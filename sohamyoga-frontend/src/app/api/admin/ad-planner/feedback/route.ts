import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const plan_id = searchParams.get('plan_id');
  const sentiment = searchParams.get('sentiment');
  const rating = searchParams.get('rating');
  const source = searchParams.get('source');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (plan_id) { conditions.push(`f.plan_id = $${idx++}`); values.push(plan_id); }
  if (sentiment) { conditions.push(`f.sentiment = $${idx++}`); values.push(sentiment); }
  if (rating) { conditions.push(`f.rating = $${idx++}`); values.push(parseInt(rating)); }
  if (source) { conditions.push(`f.source = $${idx++}`); values.push(source); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(`
    SELECT f.*, p.headline as plan_headline, p.platform as plan_platform
    FROM ad_feedback f
    LEFT JOIN ad_post_plan p ON p.id = f.plan_id
    ${where}
    ORDER BY f.created_at DESC
    LIMIT $${idx++} OFFSET $${idx++}
  `, [...values, limit, offset]);

  const summary = await query(`
    SELECT
      COUNT(*) as total,
      AVG(rating)::numeric(3,1) as avg_rating,
      COUNT(*) FILTER (WHERE sentiment = 'positive') as positive,
      COUNT(*) FILTER (WHERE sentiment = 'neutral') as neutral,
      COUNT(*) FILTER (WHERE sentiment = 'negative') as negative,
      COUNT(*) FILTER (WHERE rating = 5) as five_star,
      COUNT(*) FILTER (WHERE rating = 4) as four_star,
      COUNT(*) FILTER (WHERE rating = 3) as three_star,
      COUNT(*) FILTER (WHERE rating = 2) as two_star,
      COUNT(*) FILTER (WHERE rating = 1) as one_star
    FROM ad_feedback
  `);

  return Response.json({ feedback: result.rows, summary: summary.rows[0] });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { plan_id, customer_id, customer_name, customer_email, rating, comment, sentiment, source } = body;

  if (!plan_id) return Response.json({ error: 'plan_id required' }, { status: 400 });

  const result = await query<{ id: string }>(`
    INSERT INTO ad_feedback (plan_id, customer_id, customer_name, customer_email, rating, comment, sentiment, source)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING id
  `, [plan_id, customer_id || null, customer_name || null, customer_email || null, rating || null, comment || null, sentiment || null, source || 'organic']);

  return Response.json({ id: result.rows[0].id }, { status: 201 });
}
