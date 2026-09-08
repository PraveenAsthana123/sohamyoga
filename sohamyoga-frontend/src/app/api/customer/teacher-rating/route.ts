import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';
import { resolveStudent } from '@/lib/resolve-student';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real teacher-rating submission -- closes the last booking sub-gap (QR
// check-in and late-arrival tracking were already real; this app had no
// rating schema at all until migration 163). A rating may only be
// submitted for the student's own booking, and only once the booking is
// actually checked in -- rating a class you never attended isn't a real
// review.
export async function POST(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { bookingId?: string; rating?: number; comment?: string } | null;
  const bookingId = body?.bookingId;
  const rating = Number(body?.rating);
  const comment = typeof body?.comment === 'string' ? body.comment.slice(0, 1000) : null;
  if (!bookingId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return Response.json({ error: 'bookingId and an integer rating 1-5 are required.' }, { status: 400 });
  }

  const { principal } = await getCustomerPrincipal(req);
  const student = await resolveStudent(principal!.id);
  if (!student) return Response.json({ error: 'No student record for this account.' }, { status: 404 });

  const booking = await query<{ id: string; status: string; teacher_name: string }>(
    `SELECT b.id, b.status, cs.teacher_name FROM booking b
     JOIN class_session cs ON cs.id = b.class_session_id
     WHERE b.id = $1 AND b.student_id = $2`,
    [bookingId, student.id],
  );
  if (!booking.rows.length) return Response.json({ error: 'Booking not found.' }, { status: 404 });
  if (booking.rows[0].status !== 'checked_in') {
    return Response.json({ error: 'Only checked-in bookings can be rated.' }, { status: 409 });
  }

  const tenantId = await getPrimaryTenantId();
  const existing = await query(`SELECT id FROM teacher_rating WHERE booking_id = $1`, [bookingId]);
  if (existing.rows.length) return Response.json({ error: 'This booking has already been rated.' }, { status: 409 });

  const result = await query<{ id: string }>(
    `INSERT INTO teacher_rating (tenant_id, booking_id, student_id, teacher_name, rating, comment)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [tenantId, bookingId, student.id, booking.rows[0].teacher_name, rating, comment],
  );
  return Response.json({ ok: true, id: result.rows[0].id });
}
