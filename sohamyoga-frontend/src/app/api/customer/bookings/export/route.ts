import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';
import { resolveStudent } from '@/lib/resolve-student';
import { toCsv, csvResponse } from '@/lib/export-csv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real CSV export of the same booking history /api/customer/bookings
// returns -- no separate query path, so the export can never drift from
// what the customer sees on screen.
export async function GET(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { principal } = await getCustomerPrincipal(req);
  const student = await resolveStudent(principal!.id);
  if (!student) return Response.json({ error: 'No student record found.' }, { status: 409 });

  const bookings = await query(
    `SELECT cs.class_name, cs.teacher_name, cs.session_date::text AS session_date, cs.start_time::text AS start_time,
            cs.duration_minutes, cs.location, b.status, b.booked_at::text AS booked_at, b.checked_in_at::text AS checked_in_at
     FROM booking b JOIN class_session cs ON cs.id = b.class_session_id
     WHERE b.student_id = $1 AND b.status <> 'cancelled'
     ORDER BY cs.session_date DESC, cs.start_time DESC LIMIT 500`,
    [student.id],
  );

  const csv = toCsv(bookings.rows as Record<string, unknown>[], [
    { key: 'session_date', header: 'Date' },
    { key: 'start_time', header: 'Time' },
    { key: 'class_name', header: 'Class' },
    { key: 'teacher_name', header: 'Teacher' },
    { key: 'duration_minutes', header: 'Duration (min)' },
    { key: 'location', header: 'Location' },
    { key: 'status', header: 'Status' },
    { key: 'booked_at', header: 'Booked At' },
    { key: 'checked_in_at', header: 'Checked In At' },
  ]);
  return csvResponse(csv, 'sohamyoga-bookings.csv');
}
