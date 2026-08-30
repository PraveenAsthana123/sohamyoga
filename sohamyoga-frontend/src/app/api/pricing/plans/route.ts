import { NextRequest } from 'next/server';
import { databaseConfigured, query, transaction } from '@/lib/postgres';
import { requireAdmin, getAdminPrincipal } from '@/lib/admin-auth';
import {
  PricingPlan, type PlanType, type BillingCycle, type PlanPrice,
  type PlanBenefits, type FreezePolicy, type PausePolicy,
} from '@/domain/pricing/PricingPlan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_BENEFITS: PlanBenefits = {
  unlimitedClasses: false,
  workshopDiscountPercent: 0,
  retreatDiscountPercent: 0,
  storeDiscountPercent: 0,
  priorityBooking: false,
  vipSeating: false,
  teacherConsultationMinutes: 0,
  nutritionConsultationMinutes: 0,
  meditationSessions: 0,
  videoLibraryAccess: false,
  premiumContentAccess: false,
  certificateIssuance: false,
  corporateEventsAccess: false,
  exclusiveCommunityAccess: false,
};

const DEFAULT_FREEZE: FreezePolicy = { allowed: false, maxDaysPerYear: 0, noticeDaysRequired: 0, maxTimesPerYear: 0 };
const DEFAULT_PAUSE: PausePolicy = { allowed: false, maxDaysPerYear: 0, maxTimesPerYear: 0, noticeDaysRequired: 0 };

// GET /api/pricing/plans — plan catalog with real prices, live subscriber counts, and live MRR
// (both computed from subscription_master, never fabricated).
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const [plans, prices, counts] = await Promise.all([
    query(
      `SELECT id, name, slug, plan_type, description, status, grace_period_days,
              freeze_policy, pause_policy, benefits, upgradeable_to, downgradeable_to,
              family_config, corporate_config, trial_days, trial_eligibility,
              is_giftable, is_transferable, ab_test_variant_id, sort_order,
              created_by, created_at, updated_at
       FROM pricing_plan_master ORDER BY sort_order, name`,
    ),
    query(
      `SELECT id, plan_id, amount, currency, billing_cycle, is_promotional
       FROM pricing_plan_price ORDER BY currency, billing_cycle`,
    ),
    query<{ plan_id: string; active_subs: string; mrr: string }>(
      `SELECT plan_id, COUNT(*) AS active_subs,
              COALESCE(SUM(billing_amount) FILTER (WHERE billing_cycle IN ('monthly')), 0)
                + COALESCE(SUM(billing_amount) FILTER (WHERE billing_cycle = 'annual'), 0) / 12.0 AS mrr
       FROM subscription_master WHERE status = 'active' GROUP BY plan_id`,
    ),
  ]);

  const pricesByPlan = new Map<string, typeof prices.rows>();
  for (const p of prices.rows) {
    const list = pricesByPlan.get(p.plan_id) ?? [];
    list.push(p);
    pricesByPlan.set(p.plan_id, list);
  }
  const countsByPlan = new Map(counts.rows.map(c => [c.plan_id, c]));

  return Response.json({
    plans: plans.rows.map(p => {
      const c = countsByPlan.get(p.id);
      return {
        id: p.id, name: p.name, slug: p.slug, type: p.plan_type, description: p.description,
        status: p.status, gracePeriodDays: p.grace_period_days,
        freezePolicy: p.freeze_policy, pausePolicy: p.pause_policy, benefits: p.benefits,
        upgradeableTo: p.upgradeable_to ?? [], downgradeableTo: p.downgradeable_to ?? [],
        familyConfig: p.family_config, corporateConfig: p.corporate_config,
        trialDays: p.trial_days, trialEligibility: p.trial_eligibility,
        isGiftable: p.is_giftable, isTransferable: p.is_transferable, sortOrder: p.sort_order,
        prices: (pricesByPlan.get(p.id) ?? []).map(pr => ({
          id: pr.id, amount: Number(pr.amount), currency: pr.currency,
          billingCycle: pr.billing_cycle, isPromotional: pr.is_promotional,
        })),
        activeSubscriptions: Number(c?.active_subs ?? 0),
        mrr: Math.round(Number(c?.mrr ?? 0) * 100) / 100,
        createdAt: p.created_at, updatedAt: p.updated_at,
      };
    }),
  });
}

interface CreatePlanBody {
  name?: string; slug?: string; type?: PlanType; description?: string;
  gracePeriodDays?: number; trialDays?: number;
  trialEligibility?: 'first_time_only' | 'no_prior_membership' | 'any';
  isGiftable?: boolean; isTransferable?: boolean; sortOrder?: number;
  benefits?: Partial<PlanBenefits>; freezePolicy?: Partial<FreezePolicy>; pausePolicy?: Partial<PausePolicy>;
  prices?: { amount: number; currency: string; billingCycle: BillingCycle }[];
}

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// POST /api/pricing/plans — admin creates a new plan. Starts in 'draft' (matching
// PricingPlan's real state machine — publish via PATCH .../plans/[id] {action:'activate'}).
export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as CreatePlanBody | null;
  if (!body?.name?.trim()) return Response.json({ error: 'Plan name is required.' }, { status: 400 });
  if (!body.type) return Response.json({ error: 'Plan type is required.' }, { status: 400 });
  if (!body.prices?.length) return Response.json({ error: 'At least one price is required.' }, { status: 400 });

  const slug = body.slug?.trim() ? slugify(body.slug) : slugify(body.name);
  const prices: PlanPrice[] = body.prices.map(p => ({ amount: p.amount, currency: p.currency, billingCycle: p.billingCycle }));

  try {
    // Reuse the real domain class for validation before ever touching the DB.
    new PricingPlan({
      id: '00000000-0000-0000-0000-000000000000',
      name: body.name.trim(), slug, type: body.type, description: body.description ?? '',
      status: 'draft', prices,
      benefits: { ...DEFAULT_BENEFITS, ...body.benefits },
      gracePeriodDays: body.gracePeriodDays ?? 7,
      freezePolicy: { ...DEFAULT_FREEZE, ...body.freezePolicy },
      pausePolicy: { ...DEFAULT_PAUSE, ...body.pausePolicy },
      trialDays: body.trialDays, trialEligibility: body.trialEligibility,
      isGiftable: body.isGiftable ?? false, isTransferable: body.isTransferable ?? false,
      sortOrder: body.sortOrder ?? 0, metadata: {},
      createdBy: principal!.id, createdAt: new Date(), updatedAt: new Date(),
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Invalid plan data.' }, { status: 400 });
  }

  try {
    const id = await transaction(async (client) => {
      const planResult = await client.query<{ id: string }>(
        `INSERT INTO pricing_plan_master
          (name, slug, plan_type, description, status, grace_period_days, freeze_policy, pause_policy,
           benefits, trial_days, trial_eligibility, is_giftable, is_transferable, sort_order, created_by)
         VALUES ($1,$2,$3,$4,'draft',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
        [
          body.name!.trim(), slug, body.type, body.description ?? '', body.gracePeriodDays ?? 7,
          JSON.stringify({ ...DEFAULT_FREEZE, ...body.freezePolicy }),
          JSON.stringify({ ...DEFAULT_PAUSE, ...body.pausePolicy }),
          JSON.stringify({ ...DEFAULT_BENEFITS, ...body.benefits }),
          body.trialDays ?? null, body.trialEligibility ?? null,
          body.isGiftable ?? false, body.isTransferable ?? false, body.sortOrder ?? 0, principal!.id,
        ],
      );
      const planId = planResult.rows[0].id;
      for (const p of prices) {
        await client.query(
          `INSERT INTO pricing_plan_price (plan_id, amount, currency, billing_cycle) VALUES ($1,$2,$3,$4)`,
          [planId, p.amount, p.currency, p.billingCycle],
        );
      }
      return planId;
    });
    return Response.json({ ok: true, id, status: 'draft' }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('duplicate key') ? 409 : 502;
    return Response.json({ error: status === 409 ? 'A plan with this slug already exists.' : message }, { status });
  }
}
