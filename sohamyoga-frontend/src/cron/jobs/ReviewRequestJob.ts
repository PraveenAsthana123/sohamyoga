// ReviewRequestJob — Real Review Request Campaign. Finds bookings that were
// genuinely attended (status='checked_in') for a class that has genuinely
// ended (class_session.status='completed'), where the student hasn't
// already left a review, and queues a real notification with a link to the
// real customer-facing review page (previously the POST /api/service-reviews
// route existed with zero UI ever calling it -- src/app/reviews/submit/
// [bookingId]/page.tsx closes that gap). Idempotent per booking via
// notification_queue's own idempotency_key -- never re-sends.
import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

export async function run(): Promise<void> {
  const eligible = await db.query<{
    booking_id: string; tenant_id: string; user_id: string; email: string; class_name: string;
  }>(
    `SELECT b.id AS booking_id, b.tenant_id, s.user_id, s.email, cs.class_name
     FROM booking b
     JOIN class_session cs ON cs.id = b.class_session_id
     JOIN student s ON s.id = b.student_id
     WHERE b.status = 'checked_in' AND cs.status = 'completed'
       AND NOT EXISTS (SELECT 1 FROM service_review sr WHERE sr.booking_id = b.id)
       AND NOT EXISTS (
         SELECT 1 FROM notification_queue nq
         WHERE nq.idempotency_key = 'review_request_' || b.id::text
       )
     LIMIT 100`,
  );

  let queued = 0;
  for (const row of eligible.rows) {
    await db.query(
      `INSERT INTO notification_queue
         (tenant_id, template_slug, channel, type, recipient_user_id, recipient_address, payload, idempotency_key)
       VALUES ($1,'review_request','email','marketing',$2,$3,$4,$5)
       ON CONFLICT (tenant_id, idempotency_key) DO NOTHING`,
      [
        row.tenant_id, row.user_id, row.email,
        JSON.stringify({ bookingId: row.booking_id, className: row.class_name, reviewUrl: `/reviews/submit/${row.booking_id}` }),
        `review_request_${row.booking_id}`,
      ],
    );
    queued++;
  }

  console.log(`[review-request] eligible=${eligible.rows.length} queued=${queued}`);
  // Do NOT db.end() here — see NotificationRetryJob.ts.
}
