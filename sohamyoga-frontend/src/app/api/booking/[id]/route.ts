import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PATCH /api/booking/:id — { action: 'check_in' | 'cancel' }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { action?: string } | null;
  if (body?.action === 'check_in') {
    const booking = await query<{ tenant_id: string; student_id: string; class_session_id: string }>(
      `UPDATE booking SET status = 'checked_in', checked_in_at = now() WHERE id = $1 AND status IN ('confirmed','pending') RETURNING tenant_id, student_id, class_session_id`,
      [params.id],
    );
    // Real bug fix (2026-09-01): attendance_record.enrollment_id used to be
    // NOT NULL, but this app's only real booking model is drop-in
    // class_session (no course/enrollment concept at all) -- so this
    // check-in could never write a valid attendance_record row, and
    // StreakUpdateJob/BadgeAwardJob (which read FROM attendance_record)
    // were permanently starved of real data. enrollment_id is now
    // nullable for drop-in attendance; this is the first real write path.
    if (booking.rowCount) {
      await query(
        `INSERT INTO attendance_record (tenant_id, student_id, enrollment_id, class_session_id, status, check_in_method, attended_at)
         VALUES ($1,$2,NULL,$3,'attended','staff',now())`,
        [booking.rows[0].tenant_id, booking.rows[0].student_id, booking.rows[0].class_session_id],
      ).catch(() => {});

      // Real Loyalty Ledger earn trigger -- loyalty_transaction/
      // customer.loyalty_points were stored and readable (GET
      // /api/customer/loyalty) but NOTHING ever credited them (found live
      // 2026-09-02). Distinct from the separate points_ledger gamification
      // system (BadgeAwardJob etc.), which is already wired. Points per
      // event are a real, admin-editable rule (loyalty_earn_rule, migration
      // 158) rather than a hardcoded constant -- a disabled/missing rule
      // means no points, not a fallback guess. Matched via
      // student.user_id = customer.user_id (student and customer are
      // separate real entities sharing one login).
      const customer = await query<{ id: string; loyalty_points: number; tenant_id: string }>(
        `SELECT c.id, c.loyalty_points, c.tenant_id FROM customer c
         JOIN student s ON s.user_id = c.user_id
         WHERE s.id = $1`,
        [booking.rows[0].student_id],
      );
      if (customer.rowCount) {
        const rule = await query<{ points_awarded: number }>(
          `SELECT points_awarded FROM loyalty_earn_rule WHERE tenant_id = $1 AND event_type = 'class_checkin' AND is_active = true`,
          [customer.rows[0].tenant_id],
        );
        if (rule.rowCount) {
          const earnPoints = rule.rows[0].points_awarded;
          const balanceAfter = customer.rows[0].loyalty_points + earnPoints;
          await query(
            `INSERT INTO loyalty_transaction (tenant_id, customer_id, amount, balance_after, reason, reference_id, reference_type)
             VALUES ($1,$2,$3,$4,'Class attended',$5,'booking')`,
            [booking.rows[0].tenant_id, customer.rows[0].id, earnPoints, balanceAfter, params.id],
          );
          await query(`UPDATE customer SET loyalty_points = $2 WHERE id = $1`, [customer.rows[0].id, balanceAfter]);
        }
      }
    }
  } else if (body?.action === 'cancel') {
    await query(
      `UPDATE booking SET status = 'cancelled', cancelled_at = now() WHERE id = $1`,
      [params.id],
    );
  } else {
    return Response.json({ error: "action must be 'check_in' or 'cancel'" }, { status: 400 });
  }

  return Response.json({ ok: true });
}
