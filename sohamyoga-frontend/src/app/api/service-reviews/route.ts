import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { ServiceReview } from '@/domain/reputation/ServiceReview';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — admin moderation list (requires admin auth).
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const rows = await query(
    `SELECT sr.id, sr.booking_id, sr.reviewer_name, sr.reviewer_email, sr.star_rating, sr.comment,
            sr.status::text, sr.staff_response, sr.responded_at, sr.created_at,
            cs.class_name, cs.teacher_name, cs.session_date
     FROM service_review sr
     JOIN booking b ON b.id = sr.booking_id
     JOIN class_session cs ON cs.id = b.class_session_id
     WHERE sr.tenant_id = $1 ORDER BY sr.created_at DESC`,
    [tenantId],
  );
  return Response.json({ reviews: rows.rows });
}

// POST — real public review submission, tied to a real booking id. Prevents
// review-bombing: the booking must exist, be status='checked_in' (the real
// attended-signal in booking.status), belong to this tenant, and the
// reviewer's email must match the real student record tied to that booking
// — not merely whatever the requester typed. One review per booking.
export async function POST(req: NextRequest) {
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    bookingId?: string; reviewerName?: string; reviewerEmail?: string; starRating?: number; comment?: string;
  } | null;
  if (!body?.bookingId || !body.reviewerName || !body.reviewerEmail || body.starRating === undefined) {
    return Response.json({ error: 'bookingId, reviewerName, reviewerEmail, and starRating are required.' }, { status: 400 });
  }

  const bookingResult = await query<{ id: string; tenant_id: string; status: string; email: string }>(
    `SELECT b.id, b.tenant_id, b.status, s.email
     FROM booking b JOIN student s ON s.id = b.student_id
     WHERE b.id = $1`,
    [body.bookingId],
  );
  if (!bookingResult.rows.length) return Response.json({ error: 'Booking not found.' }, { status: 404 });
  const booking = bookingResult.rows[0];

  if (booking.status !== 'checked_in') {
    return Response.json({ error: 'Only bookings marked checked_in are eligible for a review.' }, { status: 409 });
  }
  if (booking.email.trim().toLowerCase() !== body.reviewerEmail.trim().toLowerCase()) {
    return Response.json({ error: 'reviewerEmail does not match the student on this booking.' }, { status: 403 });
  }

  try {
    new ServiceReview({
      id: '00000000-0000-0000-0000-000000000000', bookingId: body.bookingId, reviewerName: body.reviewerName,
      reviewerEmail: body.reviewerEmail, starRating: body.starRating, comment: body.comment ?? '',
      status: 'pending', createdAt: new Date(),
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Invalid review data.' }, { status: 400 });
  }

  try {
    const result = await query<{ id: string }>(
      `INSERT INTO service_review (tenant_id, booking_id, reviewer_name, reviewer_email, star_rating, comment)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [booking.tenant_id, body.bookingId, body.reviewerName, body.reviewerEmail, body.starRating, body.comment ?? ''],
    );

    // Real Service Recovery -- a low-star review automatically opens a
    // trackable case; no AI decides resolution, a human records it.
    if (body.starRating <= 2) {
      await query(
        `INSERT INTO service_recovery_case (tenant_id, review_id) VALUES ($1,$2) ON CONFLICT (review_id) DO NOTHING`,
        [booking.tenant_id, result.rows[0].id],
      );
    }

    return Response.json({ ok: true, id: result.rows[0].id, message: 'Thank you — your review has been submitted and is pending moderation.' }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('duplicate key') ? 409 : 502;
    return Response.json({ error: status === 409 ? 'A review for this booking has already been submitted.' : message }, { status });
  }
}
