import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Mirrors Coupon.ts's state machine — only these transitions are legal.
const TRANSITIONS: Record<string, string> = {
  draft: 'pending_approval',   // submit()
  paused: 'active',            // activate()
  scheduled: 'active',         // activate()
  active: 'paused',            // pause()
};

// PATCH /api/coupons/:id — { action: 'submit' | 'activate' | 'pause' }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { action?: string; pauseReason?: string } | null;
  if (!body?.action) return Response.json({ error: 'action is required' }, { status: 400 });

  const current = await query<{ status: string }>(`SELECT status FROM coupon WHERE id = $1`, [params.id]);
  if (!current.rows.length) return Response.json({ error: 'Coupon not found.' }, { status: 404 });
  const currentStatus = current.rows[0].status;
  const nextStatus = TRANSITIONS[currentStatus];

  if (!nextStatus) {
    return Response.json({ error: `Coupon in status '${currentStatus}' has no automatic transition.` }, { status: 400 });
  }
  if (body.action === 'pause' && currentStatus !== 'active') {
    return Response.json({ error: 'Only active coupons can be paused.' }, { status: 400 });
  }

  if (body.action === 'pause') {
    await query(
      `UPDATE coupon SET status = 'paused', pause_reason = $2, updated_at = now() WHERE id = $1`,
      [params.id, body.pauseReason ?? 'Paused by admin'],
    );
  } else {
    await query(`UPDATE coupon SET status = $2, updated_at = now() WHERE id = $1`, [params.id, nextStatus]);
  }

  return Response.json({ ok: true, status: body.action === 'pause' ? 'paused' : nextStatus });
}
