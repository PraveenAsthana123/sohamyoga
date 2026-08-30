import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin, getAdminPrincipal } from '@/lib/admin-auth';
import { Subscription, type SubscriptionStatus } from '@/domain/pricing/Subscription';
import type { BillingCycle, PlanType } from '@/domain/pricing/PricingPlan';
import { CYCLE_DAYS } from '@/domain/pricing/PricingRule';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_STATUSES: SubscriptionStatus[] = ['trial', 'active', 'paused', 'frozen', 'grace_period', 'expired', 'cancelled'];

// GET /api/subscriptions?status=active — real rows from subscription_master, optionally filtered.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const status = req.nextUrl.searchParams.get('status');
  if (status && !VALID_STATUSES.includes(status as SubscriptionStatus)) {
    return Response.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
  }

  const base = `SELECT s.id, s.customer_id, s.plan_id, s.plan_name, s.plan_type, s.status, s.billing_cycle,
                       s.billing_amount, s.currency, s.billing_cycle_days, s.started_at, s.expires_at,
                       s.renews_at, s.cancelled_at, s.cancel_reason, s.paused_at, s.pause_reason,
                       s.frozen_from, s.frozen_to, s.grace_period_ends_at, s.auto_renew,
                       s.pending_downgrade_plan_id, s.corporate_department, s.proration_credit,
                       (SELECT COUNT(*) FROM family_seat fs WHERE fs.subscription_id = s.id AND fs.status = 'active') AS seat_count
                FROM subscription_master s`;
  const rows = status
    ? await query(`${base} WHERE s.status = $1 ORDER BY s.created_at DESC`, [status])
    : await query(`${base} ORDER BY s.created_at DESC`);

  return Response.json({
    subscriptions: rows.rows.map(s => ({
      id: s.id, customerId: s.customer_id, planId: s.plan_id, planName: s.plan_name, planType: s.plan_type,
      status: s.status, billingCycle: s.billing_cycle, billingAmount: Number(s.billing_amount), currency: s.currency,
      startedAt: s.started_at, expiresAt: s.expires_at, renewsAt: s.renews_at, cancelledAt: s.cancelled_at,
      cancelReason: s.cancel_reason, pausedAt: s.paused_at, pauseReason: s.pause_reason,
      frozenFrom: s.frozen_from, frozenTo: s.frozen_to, gracePeriodEndsAt: s.grace_period_ends_at,
      autoRenew: s.auto_renew, pendingDowngradePlanId: s.pending_downgrade_plan_id,
      corporateDepartment: s.corporate_department, prorationCredit: Number(s.proration_credit),
      familySeatCount: Number(s.seat_count),
    })),
  });
}

interface CreateSubBody {
  customerId?: string; planId?: string; billingCycle?: BillingCycle; currency?: string;
  autoRenew?: boolean; notes?: string; corporateDepartment?: string;
}

// POST /api/subscriptions — subscribe a customer to a real, active plan at its real price.
// Starts in "trial" if the plan defines trialDays, otherwise "active" — matching the real
// Subscription state machine (activateTrial() is the only way out of "trial").
export async function POST(req: NextRequest) {
  const { denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as CreateSubBody | null;
  if (!body?.customerId?.trim()) return Response.json({ error: 'customerId is required.' }, { status: 400 });
  if (!body.planId) return Response.json({ error: 'planId is required.' }, { status: 400 });
  if (!body.billingCycle) return Response.json({ error: 'billingCycle is required.' }, { status: 400 });

  const plan = await query<{ name: string; plan_type: PlanType; status: string; trial_days: number | null }>(
    `SELECT name, plan_type, status, trial_days FROM pricing_plan_master WHERE id = $1`,
    [body.planId],
  );
  if (!plan.rows.length) return Response.json({ error: 'Plan not found.' }, { status: 404 });
  if (plan.rows[0].status !== 'active') {
    return Response.json({ error: 'Plan must be active before it can be subscribed to.' }, { status: 403 });
  }

  const currency = body.currency ?? 'CAD';
  const price = await query<{ amount: string }>(
    `SELECT amount FROM pricing_plan_price WHERE plan_id = $1 AND billing_cycle = $2 AND currency = $3 AND is_promotional = false`,
    [body.planId, body.billingCycle, currency],
  );
  if (!price.rows.length) {
    return Response.json({ error: `No ${currency} price for billing cycle "${body.billingCycle}" on this plan.` }, { status: 400 });
  }

  const billingCycleDays = CYCLE_DAYS[body.billingCycle];
  const trialDays = plan.rows[0].trial_days;
  const status: SubscriptionStatus = trialDays ? 'trial' : 'active';
  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + (trialDays ?? billingCycleDays) * 86400000);

  try {
    // Reuse the real domain class for validation before ever touching the DB.
    new Subscription({
      id: '00000000-0000-0000-0000-000000000000', customerId: body.customerId, planId: body.planId,
      planName: plan.rows[0].name, planType: plan.rows[0].plan_type, status,
      billingCycle: body.billingCycle, billingAmount: Number(price.rows[0].amount), currency, billingCycleDays,
      startedAt, expiresAt, autoRenew: body.autoRenew ?? true, familySeats: [],
      corporateDepartment: body.corporateDepartment, prorationCredit: 0, notes: body.notes ?? '',
      createdAt: startedAt, updatedAt: startedAt,
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Invalid subscription data.' }, { status: 400 });
  }

  const result = await query<{ id: string }>(
    `INSERT INTO subscription_master
      (customer_id, plan_id, plan_name, plan_type, status, billing_cycle, billing_amount, currency,
       billing_cycle_days, started_at, expires_at, auto_renew, corporate_department, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
    [
      body.customerId, body.planId, plan.rows[0].name, plan.rows[0].plan_type, status, body.billingCycle,
      Number(price.rows[0].amount), currency, billingCycleDays, startedAt, expiresAt,
      body.autoRenew ?? true, body.corporateDepartment ?? null, body.notes ?? '',
    ],
  );

  return Response.json({ ok: true, id: result.rows[0].id, status }, { status: 201 });
}
