import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/plans — PUBLIC, unauthenticated read of active membership plans +
// their CAD prices, for the public checkout page. Only safe, non-admin fields
// (name/slug/planType/description/prices) — no subscriber counts, no MRR, no
// internal ids beyond what's needed to reference a plan.
export async function GET() {
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const [plans, prices] = await Promise.all([
    query<{ id: string; name: string; slug: string; plan_type: string; description: string | null }>(
      `SELECT id, name, slug, plan_type, description FROM pricing_plan_master
       WHERE status = 'active' ORDER BY sort_order, name`,
    ),
    query<{ plan_id: string; amount: string; currency: string; billing_cycle: string }>(
      `SELECT plan_id, amount, currency, billing_cycle FROM pricing_plan_price
       WHERE currency = 'CAD' AND is_promotional = false`,
    ),
  ]);

  const pricesByPlan = new Map<string, typeof prices.rows>();
  for (const p of prices.rows) {
    const list = pricesByPlan.get(p.plan_id) ?? [];
    list.push(p);
    pricesByPlan.set(p.plan_id, list);
  }

  return Response.json({
    plans: plans.rows.map(p => ({
      id: p.id, slug: p.slug, name: p.name, planType: p.plan_type, description: p.description ?? '',
      prices: (pricesByPlan.get(p.id) ?? []).map(pr => ({ amount: Number(pr.amount), currency: pr.currency, billingCycle: pr.billing_cycle })),
    })),
  });
}
