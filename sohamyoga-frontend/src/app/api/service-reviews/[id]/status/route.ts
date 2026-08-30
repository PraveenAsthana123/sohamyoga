import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { ServiceReview, type ServiceReviewStatus } from '@/domain/reputation/ServiceReview';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ReviewRow {
  id: string; booking_id: string; reviewer_name: string; reviewer_email: string; star_rating: number;
  comment: string; status: ServiceReviewStatus; staff_response: string | null; responded_at: Date | null; created_at: Date;
}

async function loadReview(id: string): Promise<ServiceReview | null> {
  const rows = await query<ReviewRow>(
    `SELECT id, booking_id, reviewer_name, reviewer_email, star_rating, comment, status::text, staff_response, responded_at, created_at
     FROM service_review WHERE id = $1`,
    [id],
  );
  if (!rows.rows.length) return null;
  const r = rows.rows[0];
  return new ServiceReview({
    id: r.id, bookingId: r.booking_id, reviewerName: r.reviewer_name, reviewerEmail: r.reviewer_email,
    starRating: r.star_rating, comment: r.comment, status: r.status,
    staffResponse: r.staff_response ?? undefined, respondedAt: r.responded_at ?? undefined, createdAt: new Date(r.created_at),
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { action?: 'publish' | 'hide' } | null;
  if (!body?.action || !['publish', 'hide'].includes(body.action)) {
    return Response.json({ error: 'action must be "publish" or "hide".' }, { status: 400 });
  }

  const review = await loadReview(params.id);
  if (!review) return Response.json({ error: 'Review not found.' }, { status: 404 });

  let next: ServiceReview;
  try {
    next = body.action === 'publish' ? review.publish() : review.hide();
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Invalid transition.' }, { status: 409 });
  }

  await query(`UPDATE service_review SET status = $2 WHERE id = $1`, [review.id, next.toJSON().status]);
  return Response.json({ ok: true, status: next.toJSON().status });
}
