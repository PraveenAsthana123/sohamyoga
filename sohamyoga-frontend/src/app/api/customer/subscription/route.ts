import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';
import { Subscription, type SubscriptionProps } from '@/domain/pricing/Subscription';
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

function toSubscription(r: SubRow): Subscription {
  return new Subscription({
    id: r.id, customerId: r.customer_id, planId: r.plan_id, planName: r.plan_name, planType: r.plan_type,
    status: r.status, billingCycle: r.billing_cycle, billingAmount: Number(r.billing_amount), currency: r.currency,
    billingCycleDays: r.billing_cycle_days, startedAt: new Date(r.started_at), expiresAt: new Date(r.expires_at),
    renewsAt: r.renews_at ?? undefined, cancelledAt: r.cancelled_at ?? undefined, cancelReason: r.cancel_reason ?? undefined,
    pausedAt: r.paused_at ?? undefined, pauseReason: r.pause_reason ?? undefined,
    frozenFrom: r.frozen_from ?? undefined, frozenTo: r.frozen_to ?? undefined,
    gracePeriodEndsAt: r.grace_period_ends_at ?? undefined, autoRenew: r.auto_renew,
    pendingDowngradePlanId: r.pending_downgrade_plan_id ?? undefined, familySeats: [],
    corporateDepartment: r.corporate_department ?? undefined, corporateContractId: r.corporate_contract_id ?? undefined,
    prorationCredit: Number(r.proration_credit), notes: r.notes ?? '',
    createdAt: new Date(r.created_at), updatedAt: new Date(r.updated_at),
  });
}

async function resolveCustomerId(req: NextRequest): Promise<string | null> {
  const { principal } = await getCustomerPrincipal(req);
  const res = await query<{ id: string }>(`SELECT id FROM customer WHERE user_id = $1`, [principal!.id]);
  return res.rows[0]?.id ?? null;
}

// Self-service view of the real subscription_master row for this customer,
// reusing the SAME Subscription state-machine class the admin route uses --
// no duplicated business logic. Self-service actions are deliberately
// restricted to pause/resume/cancel/auto-renew; freeze/grace-period/
// corporate fields stay admin-only.
export async function GET(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const customerId = await resolveCustomerId(req);
  if (!customerId) return Response.json({ error: 'No customer record found for this account.' }, { status: 404 });

  const result = await query<SubRow>(
    `SELECT * FROM subscription_master WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [customerId],
  );
  if (!result.rowCount) return Response.json({ subscription: null });
  return Response.json({ subscription: toSubscription(result.rows[0]).toJSON() });
}

const SELF_SERVICE_ACTIONS = ['pause', 'resume', 'cancel', 'setAutoRenew', 'scheduleDowngrade'] as const;
type SelfServiceAction =
  | { action: 'pause'; reason: string }
  | { action: 'resume' }
  | { action: 'cancel'; reason: string }
  | { action: 'setAutoRenew'; enabled: boolean }
  | { action: 'scheduleDowngrade'; planId: string };

export async function PATCH(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const customerId = await resolveCustomerId(req);
  if (!customerId) return Response.json({ error: 'No customer record found for this account.' }, { status: 404 });

  const body = await req.json().catch(() => null) as SelfServiceAction | null;
  if (!body?.action || !SELF_SERVICE_ACTIONS.includes(body.action)) {
    return Response.json({ error: `action must be one of ${SELF_SERVICE_ACTIONS.join('|')}.` }, { status: 400 });
  }

  const existing = await query<SubRow>(
    `SELECT * FROM subscription_master WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [customerId],
  );
  if (!existing.rowCount) return Response.json({ error: 'No subscription found for this account.' }, { status: 404 });
  const sub = toSubscription(existing.rows[0]);

  if (body.action === 'scheduleDowngrade') {
    if (body.planId === existing.rows[0].plan_id) {
      return Response.json({ error: 'That is already your current plan.' }, { status: 400 });
    }
    const plan = await query<{ id: string }>(`SELECT id FROM pricing_plan_master WHERE id = $1 AND status = 'active'`, [body.planId]);
    if (!plan.rowCount) return Response.json({ error: 'That plan does not exist or is not active.' }, { status: 404 });
  }

  let next: Subscription;
  try {
    switch (body.action) {
      case 'pause': next = sub.pause(body.reason); break;
      case 'resume': next = sub.resume(); break;
      case 'cancel': next = sub.cancel(body.reason); break;
      case 'setAutoRenew': next = sub.setAutoRenew(body.enabled); break;
      case 'scheduleDowngrade': next = sub.scheduleDowngrade(body.planId); break;
    }
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Invalid transition.' }, { status: 409 });
  }

  const j = next.toJSON();
  await query(
    `UPDATE subscription_master SET status=$2, expires_at=$3, paused_at=$4, pause_reason=$5,
       cancelled_at=$6, cancel_reason=$7, auto_renew=$8, pending_downgrade_plan_id=$9, updated_at=now() WHERE id=$1`,
    [sub.id, j.status, j.expiresAt, j.pausedAt ?? null, j.pauseReason ?? null, j.cancelledAt ?? null, j.cancelReason ?? null, j.autoRenew, j.pendingDowngradePlanId ?? null],
  );
  return Response.json({ subscription: j });
}
