import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { draftReviewResponse } from '@/domain/reputation/ReviewResponseDrafter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real AI Response Draft -- returns a suggested reply only, never saves it.
// Staff reviews/edits, then submits via the existing POST .../respond route.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const review = await query<{ star_rating: number; comment: string; class_name: string }>(
    `SELECT sr.star_rating, sr.comment, cs.class_name
     FROM service_review sr JOIN booking b ON b.id = sr.booking_id JOIN class_session cs ON cs.id = b.class_session_id
     WHERE sr.id = $1`,
    [id],
  );
  if (!review.rows.length) return Response.json({ error: 'Review not found.' }, { status: 404 });

  try {
    const draft = await draftReviewResponse(review.rows[0].star_rating, review.rows[0].comment, review.rows[0].class_name);
    return Response.json({ draft });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Generation failed.' }, { status: 502 });
  }
}
