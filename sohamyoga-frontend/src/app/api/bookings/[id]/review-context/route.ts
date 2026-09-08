import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public by design -- the booking's own UUID is the access token (same
// pattern as a magic-link email), reached by a customer clicking a real
// review-request email, not by browsing. Returns only what the review-
// submission page needs, never full student PII.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const booking = await query<{ status: string; class_name: string; teacher_name: string; session_date: string; email: string }>(
    `SELECT b.status, cs.class_name, cs.teacher_name, cs.session_date, s.email
     FROM booking b JOIN class_session cs ON cs.id = b.class_session_id JOIN student s ON s.id = b.student_id
     WHERE b.id = $1`,
    [id],
  );
  if (!booking.rows.length) return Response.json({ error: 'Booking not found.' }, { status: 404 });
  const b = booking.rows[0];

  if (b.status !== 'checked_in') {
    return Response.json({ error: 'This booking is not eligible for a review.' }, { status: 409 });
  }

  const existingReview = await query(`SELECT 1 FROM service_review WHERE booking_id = $1`, [id]);

  return Response.json({
    className: b.class_name,
    teacherName: b.teacher_name,
    sessionDate: b.session_date,
    alreadyReviewed: (existingReview.rowCount ?? 0) > 0,
    reviewerEmail: b.email,
  });
}
