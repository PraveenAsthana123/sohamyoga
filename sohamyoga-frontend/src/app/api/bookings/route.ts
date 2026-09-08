import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { databaseConfigured, query, transaction } from '@/lib/postgres';
import { getCustomerPrincipal } from '@/lib/customer-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The real booking-creation path that was missing entirely before this
// (grep-confirmed: no INSERT INTO booking existed anywhere in customer-
// facing code). Locks the class_session row for the duration of the
// capacity check + insert so two concurrent requests for the last spot
// cannot both succeed as "confirmed" — the loser is correctly waitlisted.
export async function POST(req: NextRequest) {
  const { principal, denied } = await getCustomerPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { classSessionId?: string } | null;
  if (!body?.classSessionId) return Response.json({ error: 'classSessionId is required.' }, { status: 400 });

  const student = await query<{ id: string; tenant_id: string }>(`SELECT id, tenant_id FROM student WHERE user_id = $1`, [principal!.id]);
  if (!student.rowCount) return Response.json({ error: 'No student profile found for this account. Complete your profile before booking.' }, { status: 409 });
  const studentId = student.rows[0].id;
  const tenantId = student.rows[0].tenant_id;

  const existing = await query<{ status: string }>(`SELECT status FROM booking WHERE class_session_id = $1 AND student_id = $2`, [body.classSessionId, studentId]);
  if (existing.rowCount) return Response.json({ error: `You already have a booking for this class (status: ${existing.rows[0].status}).` }, { status: 409 });
  const existingWaitlist = await query<{ status: string }>(`SELECT status FROM waitlist_entry WHERE class_session_id = $1 AND student_id = $2 AND status = 'waiting'`, [body.classSessionId, studentId]);
  if (existingWaitlist.rowCount) return Response.json({ error: 'You are already on the waitlist for this class.' }, { status: 409 });

  try {
    const result = await transaction(async client => {
      const session = await client.query<{ id: string; capacity: number; status: string; session_date: string; start_time: string }>(
        `SELECT id, capacity, status, session_date, start_time FROM class_session WHERE id = $1 FOR UPDATE`,
        [body.classSessionId],
      );
      if (!session.rowCount) throw Object.assign(new Error('Class not found.'), { httpStatus: 404 });
      if (session.rows[0].status !== 'scheduled') throw Object.assign(new Error(`This class is ${session.rows[0].status}, not open for booking.`), { httpStatus: 409 });

      const booked = await client.query<{ count: string }>(
        `SELECT count(*)::text FROM booking WHERE class_session_id = $1 AND status IN ('pending','confirmed','checked_in')`,
        [body.classSessionId],
      );
      const hasCapacity = Number(booked.rows[0].count) < session.rows[0].capacity;

      if (hasCapacity) {
        const inserted = await client.query(
          `INSERT INTO booking (tenant_id, class_session_id, student_id, status, channel) VALUES ($1,$2,$3,'confirmed','web') RETURNING *`,
          [tenantId, body.classSessionId, studentId],
        );
        // Real QR check-in token -- registration_token/RegistrationToken.ts
        // (src/domain/identity/) had a real, well-designed check-in domain
        // model but zero writer anywhere (grep-confirmed), so QrCheckInScanner
        // had nothing real to scan against and simulated results by token
        // prefix. This is the first real token, generated at the moment a
        // booking is actually confirmed (valid window = the class's own
        // session_date/start_time, +/- a grace window).
        const sessionStart = new Date(`${session.rows[0].session_date}T${session.rows[0].start_time}`);
        await client.query(
          `INSERT INTO registration_token (id, token_value, type, reference_id, customer_id, tenant_id, valid_from, valid_until)
           VALUES ($1,$2,'class_booking',$3,$4,$5,$6,$7)`,
          [
            randomUUID(), `tk_${randomUUID().replace(/-/g, '')}`, inserted.rows[0].id, studentId, tenantId,
            new Date(sessionStart.getTime() - 60 * 60 * 1000), new Date(sessionStart.getTime() + 2 * 60 * 60 * 1000),
          ],
        );
        // Real in-app notification -- 'sent' immediately since in_app has no
        // external provider to fail against: appearing in the customer's own
        // inbox (/customer/inbox) IS the delivery. Never blocks the booking
        // itself if this insert fails.
        await client.query(
          `INSERT INTO notification_queue (tenant_id, template_slug, channel, type, recipient_user_id, recipient_address, payload, status, sent_at, idempotency_key)
           VALUES ($1,'booking_confirmation','in_app','transactional',$2,$3,$4,'sent',now(),$5)
           ON CONFLICT (tenant_id, idempotency_key) DO NOTHING`,
          [tenantId, principal!.id, principal!.email ?? '', JSON.stringify({ classSessionId: body.classSessionId, sessionDate: session.rows[0].session_date, startTime: session.rows[0].start_time }), `booking-confirm-${inserted.rows[0].id}`],
        ).catch(() => {});
        return { outcome: 'confirmed' as const, booking: inserted.rows[0] };
      }

      const position = await client.query<{ next: string }>(
        `SELECT coalesce(max(position), 0) + 1 AS next FROM waitlist_entry WHERE class_session_id = $1`,
        [body.classSessionId],
      );
      const inserted = await client.query(
        `INSERT INTO waitlist_entry (tenant_id, class_session_id, student_id, position) VALUES ($1,$2,$3,$4) RETURNING *`,
        [tenantId, body.classSessionId, studentId, Number(position.rows[0].next)],
      );
      await client.query(
        `INSERT INTO notification_queue (tenant_id, template_slug, channel, type, recipient_user_id, recipient_address, payload, status, sent_at, idempotency_key)
         VALUES ($1,'booking_waitlisted','in_app','transactional',$2,$3,$4,'sent',now(),$5)
         ON CONFLICT (tenant_id, idempotency_key) DO NOTHING`,
        [tenantId, principal!.id, principal!.email ?? '', JSON.stringify({ classSessionId: body.classSessionId, position: Number(position.rows[0].next) }), `booking-waitlist-${inserted.rows[0].id}`],
      ).catch(() => {});
      return { outcome: 'waitlisted' as const, waitlistEntry: inserted.rows[0] };
    });
    return Response.json(result, { status: 201 });
  } catch (error) {
    const httpStatus = (error as { httpStatus?: number }).httpStatus ?? 500;
    const message = error instanceof Error ? error.message : 'Booking failed.';
    return Response.json({ error: message }, { status: httpStatus });
  }
}
