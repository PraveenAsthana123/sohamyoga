import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? '';
  const rating = searchParams.get('rating') ?? '';

  const client = await pool.connect();
  try {
    const conditions: string[] = [];
    const values: string[] = [];
    if (status && status !== 'all') {
      conditions.push(`sr.status::text = $${values.length + 1}`);
      values.push(status);
    }
    if (rating) {
      conditions.push(`sr.star_rating = $${values.length + 1}`);
      values.push(rating);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [reviews, kpi, byRating] = await Promise.all([
      client.query(
        `SELECT sr.id, sr.reviewer_name, sr.reviewer_email, sr.star_rating,
                sr.comment, sr.status::text AS status,
                sr.staff_response, sr.responded_at, sr.created_at,
                b.service_id AS service_name
         FROM service_review sr
         LEFT JOIN booking b ON b.id = sr.booking_id
         ${where}
         ORDER BY sr.created_at DESC LIMIT 200`,
        values,
      ),
      client.query(
        `SELECT
           COUNT(*)::int AS total,
           COALESCE(AVG(star_rating), 0)::numeric(3,2) AS avg_rating,
           COUNT(*) FILTER (WHERE star_rating = 5)::int AS five_star,
           COUNT(*) FILTER (WHERE status::text = 'published')::int AS published
         FROM service_review`,
      ),
      client.query(
        `SELECT star_rating, COUNT(*)::int AS cnt
         FROM service_review GROUP BY star_rating ORDER BY star_rating DESC`,
      ),
    ]);

    return Response.json({
      reviews: reviews.rows,
      kpi: kpi.rows[0],
      byRating: byRating.rows,
    });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as { id?: string; status?: string } | null;
  if (!body?.id || !body?.status) {
    return Response.json({ error: 'id and status are required.' }, { status: 400 });
  }
  const valid = ['pending', 'published', 'hidden'];
  if (!valid.includes(body.status)) {
    return Response.json({ error: `status must be one of: ${valid.join(', ')}.` }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE service_review SET status = $2::service_review_status WHERE id = $1 RETURNING id`,
      [body.id, body.status],
    );
    if (!result.rowCount) return Response.json({ error: 'Review not found.' }, { status: 404 });
    return Response.json({ ok: true });
  } finally {
    client.release();
  }
}
