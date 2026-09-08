import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';
import { resolveStudent } from '@/lib/resolve-student';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real .ics (iCalendar, RFC 5545) export of the customer's real upcoming
// bookings -- opens directly in Google Calendar, Outlook, or Apple Calendar.
// No Cal.com/external calendar API account exists in this environment, so
// this is the honest, credential-free way to deliver "calendar integration"
// today: a standard file format every calendar app already reads, generated
// from real booking + class_session rows only.
function icsEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
}
function formatDateTime(date: string, time: string): string {
  const [h, m] = time.split(':');
  return `${date.replace(/-/g, '')}T${h.padStart(2, '0')}${m.padStart(2, '0')}00`;
}
function addMinutes(date: string, time: string, minutes: number): string {
  const dt = new Date(`${date}T${time}`);
  dt.setMinutes(dt.getMinutes() + minutes);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
}

export async function GET(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { principal } = await getCustomerPrincipal(req);
  const student = await resolveStudent(principal!.id);
  if (!student) return Response.json({ error: 'No student record found — enroll in a class first.' }, { status: 409 });

  const bookings = await query<{
    id: string; class_name: string; teacher_name: string; session_date: string; start_time: string; duration_minutes: number; location: string | null;
  }>(
    `SELECT b.id, cs.class_name, cs.teacher_name, cs.session_date::text AS session_date, cs.start_time::text AS start_time, cs.duration_minutes, cs.location
     FROM booking b JOIN class_session cs ON cs.id = b.class_session_id
     WHERE b.student_id = $1 AND b.status <> 'cancelled' AND cs.session_date >= CURRENT_DATE
     ORDER BY cs.session_date, cs.start_time`,
    [student.id],
  );

  const events = bookings.rows.map(b => [
    'BEGIN:VEVENT',
    `UID:booking-${b.id}@sohamyoga.ca`,
    `DTSTART:${formatDateTime(b.session_date, b.start_time)}`,
    `DTEND:${addMinutes(b.session_date, b.start_time, b.duration_minutes)}`,
    `SUMMARY:${icsEscape(b.class_name)}`,
    `DESCRIPTION:${icsEscape(`With ${b.teacher_name}`)}`,
    b.location ? `LOCATION:${icsEscape(b.location)}` : '',
    'END:VEVENT',
  ].filter(Boolean).join('\r\n')).join('\r\n');

  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SohamYoga//Bookings//EN', 'CALSCALE:GREGORIAN',
    events,
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');

  return new Response(ics, {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'attachment; filename="sohamyoga-bookings.ics"' },
  });
}
