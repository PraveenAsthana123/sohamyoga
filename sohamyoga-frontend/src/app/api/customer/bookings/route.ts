import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';
import { resolveStudent } from '@/lib/resolve-student';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real upcoming/past bookings, joined from the real booking + class_session
// tables. Replaces /student/calendar and /student/history, which were
// hardcoded arrays with no backing table at all.
export async function GET(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { principal } = await getCustomerPrincipal(req);
  const student = await resolveStudent(principal!.id);
  if (!student) return Response.json({ upcoming: [], past: [], hasStudentRecord: false });

  interface BookingRow {
    id: string; status: string; booked_at: string; checked_in_at: string | null;
    class_name: string; teacher_name: string; session_date: string; start_time: string; duration_minutes: number; location: string | null;
    my_rating: number | null;
  }
  const bookings = await query<BookingRow>(
    `SELECT b.id, b.status, b.booked_at, b.checked_in_at, cs.class_name, cs.teacher_name, cs.session_date::text AS session_date, cs.start_time, cs.duration_minutes, cs.location,
            tr.rating AS my_rating
     FROM booking b JOIN class_session cs ON cs.id = b.class_session_id
     LEFT JOIN teacher_rating tr ON tr.booking_id = b.id
     WHERE b.student_id = $1 AND b.status <> 'cancelled'
     ORDER BY cs.session_date DESC, cs.start_time DESC LIMIT 100`,
    [student.id],
  );

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = bookings.rows.filter(b => b.session_date.slice(0, 10) >= today);
  const past = bookings.rows.filter(b => b.session_date.slice(0, 10) < today);
  return Response.json({ upcoming, past, hasStudentRecord: true });
}
