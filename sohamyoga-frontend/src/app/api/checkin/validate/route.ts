import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAdmin, getAdminPrincipal } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CheckInResult = 'valid' | 'already_scanned' | 'wrong_class' | 'too_early' | 'cancelled' | 'unknown_token';

// Real QR Check-In Validation -- registration_token/RegistrationToken.ts had
// a real, well-designed domain model (isActive/isAlreadyScanned/recordScan)
// but zero writer or reader anywhere; QrCheckInScanner.tsx simulated results
// by matching a hardcoded token prefix. This is the first real validate
// path, applying the same result vocabulary the domain class already
// defined, against the real registration_token/booking/class_session rows.
export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { tokenValue?: string; classSessionId?: string; deviceId?: string } | null;
  if (!body?.tokenValue?.trim() || !body.classSessionId) {
    return Response.json({ error: 'tokenValue and classSessionId are required.' }, { status: 400 });
  }
  const deviceId = body.deviceId || 'unknown-device';
  const scannedBy = principal!.email ?? principal!.id;

  const token = await query<{
    id: string; status: string; reference_id: string; valid_from: string; valid_until: string; tenant_id: string;
  }>(
    `SELECT id, status, reference_id, valid_from, valid_until, tenant_id FROM registration_token WHERE token_value = $1 AND type = 'class_booking'`,
    [body.tokenValue.trim()],
  );

  let result: CheckInResult;
  let tokenId: string | null = null;
  let bookingId: string | null = null;

  if (!token.rowCount) {
    result = 'unknown_token';
  } else {
    const t = token.rows[0];
    tokenId = t.id;
    bookingId = t.reference_id;
    const booking = await query<{ class_session_id: string; status: string }>(
      `SELECT class_session_id, status FROM booking WHERE id = $1`, [bookingId],
    );
    const now = new Date();
    if (t.status === 'used') result = 'already_scanned';
    else if (t.status === 'cancelled' || t.status === 'revoked') result = 'cancelled';
    else if (!booking.rowCount || booking.rows[0].class_session_id !== body.classSessionId) result = 'wrong_class';
    else if (now < new Date(t.valid_from)) result = 'too_early';
    else if (now >= new Date(t.valid_until)) result = 'unknown_token';
    else result = 'valid';
  }

  if (tokenId) {
    await query(
      `INSERT INTO registration_token_scan (id, token_id, scanned_by, device_id, result, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [randomUUID(), tokenId, scannedBy, deviceId, result, token.rows[0].tenant_id],
    );
  }

  if (result === 'valid' && bookingId) {
    await query(`UPDATE registration_token SET status = 'used', scan_count = scan_count + 1, last_scanned_at = now() WHERE id = $1`, [tokenId]);

    const checkedIn = await query<{ tenant_id: string; student_id: string; class_session_id: string }>(
      `UPDATE booking SET status = 'checked_in', checked_in_at = now() WHERE id = $1 AND status IN ('confirmed','pending') RETURNING tenant_id, student_id, class_session_id`,
      [bookingId],
    );
    if (checkedIn.rowCount) {
      await query(
        `INSERT INTO attendance_record (tenant_id, student_id, enrollment_id, class_session_id, status, check_in_method, attended_at)
         VALUES ($1,$2,NULL,$3,'attended','qr_scan',now())`,
        [checkedIn.rows[0].tenant_id, checkedIn.rows[0].student_id, checkedIn.rows[0].class_session_id],
      ).catch(() => {});

      const customer = await query<{ id: string; loyalty_points: number; tenant_id: string }>(
        `SELECT c.id, c.loyalty_points, c.tenant_id FROM customer c JOIN student s ON s.user_id = c.user_id WHERE s.id = $1`,
        [checkedIn.rows[0].student_id],
      );
      if (customer.rowCount) {
        const rule = await query<{ points_awarded: number }>(
          `SELECT points_awarded FROM loyalty_earn_rule WHERE tenant_id = $1 AND event_type = 'class_checkin' AND is_active = true`,
          [customer.rows[0].tenant_id],
        );
        if (rule.rowCount) {
          const balanceAfter = customer.rows[0].loyalty_points + rule.rows[0].points_awarded;
          await query(
            `INSERT INTO loyalty_transaction (tenant_id, customer_id, amount, balance_after, reason, reference_id, reference_type)
             VALUES ($1,$2,$3,$4,'Class attended (QR)',$5,'booking')`,
            [checkedIn.rows[0].tenant_id, customer.rows[0].id, rule.rows[0].points_awarded, balanceAfter, bookingId],
          );
          await query(`UPDATE customer SET loyalty_points = $2 WHERE id = $1`, [customer.rows[0].id, balanceAfter]);
        }
      }
    } else {
      result = 'already_scanned';
    }
  } else if (tokenId && result !== 'valid') {
    // Non-valid outcomes still count as a scan attempt for auditing.
  }

  return Response.json({ result, tokenId, bookingId });
}
