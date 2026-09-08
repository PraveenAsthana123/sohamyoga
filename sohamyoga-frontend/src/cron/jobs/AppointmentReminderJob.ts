// AppointmentReminderJob — Every 15 minutes
// customer.reminder_minutes_before was captured at onboarding and displayed
// nowhere else, but nothing ever queued a reminder before class (found live
// 2026-09-02, same class of gap as the loyalty-earn and consent-check fixes
// this session). Real trigger: a confirmed booking whose class starts within
// the customer's own reminder window, not yet reminded (idempotency_key
// keyed per booking, matching the booking_confirmation/booking_waitlisted
// pattern already used in POST /api/bookings).

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

export async function run(): Promise<void> {
  const due = await db.query<{
    booking_id: string; tenant_id: string; user_id: string; email: string;
    class_name: string; session_date: string; start_time: string;
  }>(`
    SELECT b.id AS booking_id, b.tenant_id, s.user_id, c.email,
           cs.class_name, cs.session_date, cs.start_time
    FROM booking b
    JOIN student s ON s.id = b.student_id
    JOIN customer c ON c.user_id = s.user_id
    JOIN class_session cs ON cs.id = b.class_session_id
    WHERE b.status = 'confirmed'
      AND (cs.session_date + cs.start_time) > now()
      AND (cs.session_date + cs.start_time) <= now() + (c.reminder_minutes_before || ' minutes')::interval
  `);

  let queued = 0;
  for (const row of due.rows) {
    const result = await db.query(
      `INSERT INTO notification_queue (tenant_id, template_slug, channel, type, recipient_user_id, recipient_address, payload, status, sent_at, idempotency_key)
       VALUES ($1,'appointment_reminder','in_app','reminder',$2,$3,$4,'sent',now(),$5)
       ON CONFLICT (tenant_id, idempotency_key) DO NOTHING`,
      [row.tenant_id, row.user_id, row.email,
       JSON.stringify({ className: row.class_name, sessionDate: row.session_date, startTime: row.start_time }),
       `appointment-reminder-${row.booking_id}`],
    );
    if ((result.rowCount ?? 0) > 0) queued++;
  }

  console.log(`[appointment-reminder] due=${due.rows.length} queued=${queued}`);
  // Do NOT db.end() here — see NotificationRetryJob.ts.
}
