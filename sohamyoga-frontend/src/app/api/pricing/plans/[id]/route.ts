import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import {
  PricingPlan, type PlanType, type PlanStatus, type BillingCycle,
  type PlanBenefits, type FreezePolicy, type PausePolicy, type FamilyConfig, type CorporateConfig,
} from '@/domain/pricing/PricingPlan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PlanRow {
  id: string; name: string; slug: string; plan_type: PlanType; description: string; status: PlanStatus;
  grace_period_days: number; freeze_policy: FreezePolicy; pause_policy: PausePolicy; benefits: PlanBenefits;
  upgradeable_to: string[] | null; downgradeable_to: string[] | null;
  family_config: FamilyConfig | null; corporate_config: CorporateConfig | null;
  trial_days: number | null; trial_eligibility: 'first_time_only' | 'no_prior_membership' | 'any' | null;
  is_giftable: boolean; is_transferable: boolean; ab_test_variant_id: string | null; sort_order: number;
  metadata: Record<string, unknown> | null; created_by: string; created_at: Date; updated_at: Date;
}

async function loadPlan(id: string): Promise<PricingPlan | null> {
  const rows = await query<PlanRow>(
    `SELECT p.*, COALESCE(json_agg(json_build_object('amount', pr.amount, 'currency', pr.currency, 'billingCycle', pr.billing_cycle))
            FILTER (WHERE pr.id IS NOT NULL), '[]') AS prices
     FROM pricing_plan_master p LEFT JOIN pricing_plan_price pr ON pr.plan_id = p.id
     WHERE p.id = $1 GROUP BY p.id`,
    [id],
  );
  if (!rows.rows.length) return null;
  const r = rows.rows[0] as PlanRow & { prices: { amount: string; currency: string; billingCycle: BillingCycle }[] };
  const prices = r.prices.length
    ? r.prices.map(p => ({ amount: Number(p.amount), currency: p.currency, billingCycle: p.billingCycle }))
    : [{ amount: 0, currency: 'CAD', billingCycle: 'monthly' as BillingCycle }]; // placeholder only if somehow priceless; DB always has >=1 in practice
  return new PricingPlan({
    id: r.id, name: r.name, slug: r.slug, type: r.plan_type, description: r.description ?? '',
    status: r.status, prices, benefits: r.benefits, gracePeriodDays: r.grace_period_days,
    freezePolicy: r.freeze_policy, pausePolicy: r.pause_policy,
    trialDays: r.trial_days ?? undefined, trialEligibility: r.trial_eligibility ?? undefined,
    upgradeableTo: r.upgradeable_to ?? [], downgradeableTo: r.downgradeable_to ?? [],
    familyConfig: r.family_config ?? undefined, corporateConfig: r.corporate_config ?? undefined,
    isGiftable: r.is_giftable, isTransferable: r.is_transferable, sortOrder: r.sort_order,
    abTestVariantId: r.ab_test_variant_id ?? undefined, metadata: r.metadata ?? {},
    createdBy: r.created_by, createdAt: new Date(r.created_at), updatedAt: new Date(r.updated_at),
  });
}

// PATCH /api/pricing/plans/[id] — state transitions via the real PricingPlan class
// (activate/deprecate/archive), or a new price via addPrice. Never reimplements the
// state machine here — reconstructs the class from DB rows and calls its real methods.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    action?: 'activate' | 'deprecate' | 'archive';
    addPrice?: { amount: number; currency: string; billingCycle: BillingCycle };
  } | null;
  if (!body?.action && !body?.addPrice) {
    return Response.json({ error: 'action ("activate"|"deprecate"|"archive") or addPrice is required.' }, { status: 400 });
  }

  const plan = await loadPlan(params.id);
  if (!plan) return Response.json({ error: 'Plan not found.' }, { status: 404 });

  let next: PricingPlan;
  try {
    if (body.action) {
      next = body.action === 'activate' ? plan.activate() : body.action === 'deprecate' ? plan.deprecate() : plan.archive();
    } else {
      next = plan.addPrice(body.addPrice!);
    }
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Invalid transition.' }, { status: 409 });
  }

  if (body.action) {
    await query(`UPDATE pricing_plan_master SET status = $2, updated_at = now() WHERE id = $1`, [plan.id, next.status]);
  } else {
    await query(
      `INSERT INTO pricing_plan_price (plan_id, amount, currency, billing_cycle)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (plan_id, currency, billing_cycle, is_promotional) DO UPDATE SET amount = EXCLUDED.amount`,
      [plan.id, body.addPrice!.amount, body.addPrice!.currency, body.addPrice!.billingCycle],
    );
    await query(`UPDATE pricing_plan_master SET updated_at = now() WHERE id = $1`, [plan.id]);
  }

  return Response.json({ ok: true, status: next.status });
}
