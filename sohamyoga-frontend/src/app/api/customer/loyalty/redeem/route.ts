import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real Redemption Rule Builder / Redemption flow -- matches the exact same
// customer.loyalty_points-as-authoritative-balance pattern the real earn
// trigger uses (src/app/api/booking/[id]/route.ts): read loyalty_points,
// update it AND insert the loyalty_transaction together. Writes a real
// negative transaction (balance_after >= 0 is enforced by the table's own
// CHECK constraint, so a race condition can't drive a customer negative)
// and decrements catalog stock.
export async function POST(req: NextRequest) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { rewardId?: string } | null;
  if (!body?.rewardId) return Response.json({ error: 'rewardId is required.' }, { status: 400 });

  const { principal } = await getCustomerPrincipal(req);
  const customer = await query<{ id: string; loyalty_points: number; tenant_id: string }>(
    `SELECT id, loyalty_points, tenant_id FROM customer WHERE user_id = $1`, [principal!.id],
  );
  if (!customer.rowCount) return Response.json({ error: 'No customer record found for this account.' }, { status: 404 });
  const { id: customerId, loyalty_points: currentBalance, tenant_id: tenantId } = customer.rows[0];

  const reward = await query<{ id: string; name: string; points_cost: number; is_active: boolean; stock: number | null }>(
    `SELECT id, name, points_cost, is_active, stock FROM reward_catalog_item WHERE id = $1`,
    [body.rewardId],
  );
  if (!reward.rowCount || !reward.rows[0].is_active) return Response.json({ error: 'Reward not available.' }, { status: 404 });
  const r = reward.rows[0];
  if (r.stock !== null && r.stock <= 0) return Response.json({ error: 'This reward is out of stock.' }, { status: 409 });

  if (currentBalance < r.points_cost) {
    return Response.json({ error: `Insufficient points: you have ${currentBalance}, this reward costs ${r.points_cost}.` }, { status: 409 });
  }

  const newBalance = currentBalance - r.points_cost;
  try {
    await query(
      `INSERT INTO loyalty_transaction (tenant_id, customer_id, amount, balance_after, reason, reference_id, reference_type)
       VALUES ($1,$2,$3,$4,$5,$6,'reward_redemption')`,
      [tenantId, customerId, -r.points_cost, newBalance, `Redeemed: ${r.name}`, r.id],
    );
  } catch (err) {
    if (err instanceof Error && err.message.includes('chk_loyalty_nonneg')) {
      return Response.json({ error: 'Insufficient points (balance changed).' }, { status: 409 });
    }
    throw err;
  }
  await query(`UPDATE customer SET loyalty_points = $2 WHERE id = $1`, [customerId, newBalance]);
  if (r.stock !== null) {
    await query(`UPDATE reward_catalog_item SET stock = stock - 1, updated_at = now() WHERE id = $1`, [r.id]);
  }

  return Response.json({ ok: true, newBalance });
}
