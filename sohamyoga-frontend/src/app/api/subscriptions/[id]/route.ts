import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { Subscription, type SubscriptionProps, type FamilySeat } from '@/domain/pricing/Subscription';
import type { BillingCycle, PlanType } from '@/domain/pricing/PricingPlan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SubRow {
  id: string; customer_id: string; plan_id: string; plan_name: string; plan_type: PlanType;
  status: SubscriptionProps['status']; billing_cycle: BillingCycle; billing_amount: string; currency: string;
  billing_cycle_days: number; started_at: Date; expires_at: Date; renews_at: Date | null;
  cancelled_at: Date | null; cancel_reason: string | null; paused_at: Date | null; pause_reason: string | null;
  frozen_from: Date | null; frozen_to: Date | null; grace_period_ends_at: Date | null; auto_renew: boolean;
  pending_downgrade_plan_id: string | null; corporate_department: string | null; corporate_contract_id: string | null;
  proration_credit: string; notes: string | null; created_at: Date; updated_at: Date;
}

async function loadSubscription(id: string): Promise<Subscription | null> {
  const [subRows, seatRows] = await Promise.all([
    query<SubRow>(`SELECT * FROM subscription_master WHERE id = $1`, [id]),
    query<{ customer_id: string; member_name: string; added_at: Date; status: string }>(
      `SELECT customer_id, member_name, added_at, status FROM family_seat WHERE subscription_id = $1`, [id],
    ),
  ]);
  if (!subRows.rows.length) return null;
  const r = subRows.rows[0];
  const familySeats: FamilySeat[] = seatRows.rows.map(s => ({
    customerId: s.customer_id, memberName: s.member_name, addedAt: new Date(s.added_at),
    status: s.status as 'active' | 'removed',
  }));
  return new Subscription({
    id: r.id, customerId: r.customer_id, planId: r.plan_id, planName: r.plan_name, planType: r.plan_type,
    status: r.status, billingCycle: r.billing_cycle, billingAmount: Number(r.billing_amount), currency: r.currency,
    billingCycleDays: r.billing_cycle_days, startedAt: new Date(r.started_at), expiresAt: new Date(r.expires_at),
    renewsAt: r.renews_at ?? undefined, cancelledAt: r.cancelled_at ?? undefined, cancelReason: r.cancel_reason ?? undefined,
    pausedAt: r.paused_at ?? undefined, pauseReason: r.pause_reason ?? undefined,
    frozenFrom: r.frozen_from ?? undefined, frozenTo: r.frozen_to ?? undefined,
    gracePeriodEndsAt: r.grace_period_ends_at ?? undefined, autoRenew: r.auto_renew,
    pendingDowngradePlanId: r.pending_downgrade_plan_id ?? undefined, familySeats,
    corporateDepartment: r.corporate_department ?? undefined, corporateContractId: r.corporate_contract_id ?? undefined,
    prorationCredit: Number(r.proration_credit), notes: r.notes ?? '',
    createdAt: new Date(r.created_at), updatedAt: new Date(r.updated_at),
  });
}

type Action =
  | { action: 'activateTrial' }
  | { action: 'pause'; reason: string }
  | { action: 'resume' }
  | { action: 'freeze'; from: string; to: string }
  | { action: 'unfreeze' }
  | { action: 'enterGracePeriod'; graceDays: number }
  | { action: 'expire' }
  | { action: 'cancel'; reason: string }
  | { action: 'setAutoRenew'; enabled: boolean };

// PATCH /api/subscriptions/[id] — every transition goes through the real Subscription
// class's state machine (pause/resume/freeze/unfreeze/cancel/...). The route never
// reimplements the logic — it reconstructs the class from the DB row and calls the method.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as Action | null;
  if (!body?.action) {
    return Response.json({ error: 'action is required (activateTrial|pause|resume|freeze|unfreeze|enterGracePeriod|expire|cancel|setAutoRenew).' }, { status: 400 });
  }

  const sub = await loadSubscription(params.id);
  if (!sub) return Response.json({ error: 'Subscription not found.' }, { status: 404 });

  let next: Subscription;
  try {
    switch (body.action) {
      case 'activateTrial': next = sub.activateTrial(); break;
      case 'pause': next = sub.pause(body.reason); break;
      case 'resume': next = sub.resume(); break;
      case 'freeze': next = sub.freeze(new Date(body.from), new Date(body.to)); break;
      case 'unfreeze': next = sub.unfreeze(); break;
      case 'enterGracePeriod': next = sub.enterGracePeriod(body.graceDays); break;
      case 'expire': next = sub.expire(); break;
      case 'cancel': next = sub.cancel(body.reason); break;
      case 'setAutoRenew': next = sub.setAutoRenew(body.enabled); break;
      default: return Response.json({ error: 'Unknown action.' }, { status: 400 });
    }
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Invalid transition.' }, { status: 409 });
  }

  const j = next.toJSON();
  await query(
    `UPDATE subscription_master SET
       status = $2, expires_at = $3, paused_at = $4, pause_reason = $5,
       frozen_from = $6, frozen_to = $7, grace_period_ends_at = $8,
       cancelled_at = $9, cancel_reason = $10, auto_renew = $11, updated_at = now()
     WHERE id = $1`,
    [
      sub.id, j.status, j.expiresAt, j.pausedAt ?? null, j.pauseReason ?? null,
      j.frozenFrom ?? null, j.frozenTo ?? null, j.gracePeriodEndsAt ?? null,
      j.cancelledAt ?? null, j.cancelReason ?? null, j.autoRenew,
    ],
  );

  return Response.json({ ok: true, status: next.status, expiresAt: j.expiresAt });
}
