import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real loyalty tier + point ledger (loyalty_transaction), distinct from the
// separate gamification points_ledger system exposed via /api/customer/journey
// -- these are two genuinely different real systems (tenant loyalty tiers
// vs. attendance gamification), not a duplicate.
export async function GET(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { principal } = await getCustomerPrincipal(req);
  const customer = await query<{ id: string; tier: string; loyalty_points: number; lifetime_spend_cad: string }>(
    `SELECT id, tier, loyalty_points, lifetime_spend_cad FROM customer WHERE user_id = $1`, [principal!.id],
  );
  if (!customer.rowCount) return Response.json({ error: 'No customer record found for this account.' }, { status: 404 });

  const [tierInfo, history] = await Promise.all([
    query(`SELECT code, label, min_spend_cad, discount_pct, monthly_bonus_pts FROM ref_customer_tier ORDER BY min_spend_cad`),
    query(
      `SELECT amount, balance_after, reason, created_at FROM loyalty_transaction WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [customer.rows[0].id],
    ),
  ]);

  return Response.json({
    tier: customer.rows[0].tier,
    loyaltyPoints: customer.rows[0].loyalty_points,
    lifetimeSpendCad: Number(customer.rows[0].lifetime_spend_cad),
    allTiers: tierInfo.rows,
    history: history.rows,
  });
}
