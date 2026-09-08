import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { draftReviewResponse } from '@/domain/reputation/ReviewResponseDrafter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real AI Reply Draft for Google Business Profile reviews -- reuses the
// same real ReviewResponseDrafter.ts already built for service_review,
// wired here for the first time. Returns a suggested reply only, never
// posts it -- staff edits and submits via the existing real
// POST .../reply route, which is the only thing that ever talks to Google.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const review = await query<{ star_rating: number | null; comment: string | null }>(
    `SELECT star_rating, comment FROM business_review WHERE id = $1`,
    [id],
  );
  if (!review.rows.length) return Response.json({ error: 'Review not found.' }, { status: 404 });

  try {
    const draft = await draftReviewResponse(review.rows[0].star_rating ?? 3, review.rows[0].comment ?? '', 'the studio');
    return Response.json({ draft });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Failed to draft a reply.' }, { status: 502 });
  }
}
