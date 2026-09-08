import { NextRequest, NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/requireCustomer';
import { getMonthlyCostCap, monthToDateCostForCustomer } from '@/domain/customer/repository';
import { query } from '@/lib/db';

// Real usage/billing view -- monthToDateCostForCustomer/getMonthlyCostCap
// already existed (used internally by the webhook's cost-cap-exceeded
// check) but nothing ever exposed them to the business itself. Now that
// the Vapi webhook receiver auto-fills call_log.cost_usd on every real
// call, this is real spend, not an estimate.
export async function GET(req: NextRequest) {
  const auth = await requireCustomer(req);
  if (auth.denied) return auth.denied;

  const [spentUsd, capUsd, monthStats] = await Promise.all([
    monthToDateCostForCustomer(auth.principal.id),
    getMonthlyCostCap(auth.principal.id),
    query<{ call_count: string; total_duration_seconds: string | null }>(
      `SELECT count(*)::text AS call_count, SUM(cl.duration_seconds)::text AS total_duration_seconds
         FROM call_log cl JOIN contact c ON c.id = cl.contact_id
        WHERE c.owner_customer_id = $1 AND date_trunc('month', cl.created_at) = date_trunc('month', now())`,
      [auth.principal.id],
    ),
  ]);

  const callCount = Number(monthStats.rows[0]?.call_count ?? 0);
  const totalDurationSeconds = Number(monthStats.rows[0]?.total_duration_seconds ?? 0);

  return NextResponse.json({
    monthToDateSpendUsd: spentUsd,
    monthlyCostCapUsd: capUsd,
    callCount,
    totalDurationSeconds,
    avgCostPerCallUsd: callCount > 0 ? spentUsd / callCount : 0,
  });
}
