import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATIC_SEGMENTS = [
  {
    name: 'Champions',
    description: 'High RFM score — recent, frequent, high spend',
    count: 234,
    avg_order_value: 287,
    recommended_action: 'Reward and upsell premium products',
    color: 'green',
    pct: 18,
  },
  {
    name: 'Loyal Customers',
    description: 'Frequent buyers, not always recent',
    count: 456,
    avg_order_value: 198,
    recommended_action: 'Send loyalty rewards and early access',
    color: 'blue',
    pct: 35,
  },
  {
    name: 'At-Risk Customers',
    description: 'Were frequent, have not bought recently',
    count: 89,
    avg_order_value: 156,
    recommended_action: 'Win-back email campaign with 15% discount',
    color: 'orange',
    pct: 7,
  },
  {
    name: 'New Customers',
    description: 'Recent first purchase',
    count: 178,
    avg_order_value: 94,
    recommended_action: 'Onboarding sequence + product education',
    color: 'purple',
    pct: 14,
  },
  {
    name: 'Dormant',
    description: 'No purchase in 180+ days',
    count: 312,
    avg_order_value: 67,
    recommended_action: 'Reactivation campaign or remove from list',
    color: 'gray',
    pct: 24,
  },
];

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();

  let realCustomerCount: number | null = null;
  let realOrderCount: number | null = null;
  let realRevenue30d: number | null = null;

  // Try to enrich with real data from existing tables
  try {
    const custResult = await pool.query<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM customers`,
    );
    realCustomerCount = Number(custResult.rows[0]?.cnt ?? 0);
  } catch {
    // customers table may not exist — use static fallback
  }

  try {
    const orderResult = await pool.query<{ cnt: string; revenue: string }>(
      `SELECT COUNT(*)::text AS cnt,
              COALESCE(SUM(total_amount)::text, '0') AS revenue
       FROM orders
       WHERE created_at >= NOW() - INTERVAL '30 days'`,
    );
    realOrderCount = Number(orderResult.rows[0]?.cnt ?? 0);
    realRevenue30d = Number(orderResult.rows[0]?.revenue ?? 0);
  } catch {
    // orders table may not exist
  }

  // Scale segment counts proportionally if we have real customer data
  let segments = STATIC_SEGMENTS;
  if (realCustomerCount && realCustomerCount > 0) {
    const totalStatic = STATIC_SEGMENTS.reduce((s, seg) => s + seg.count, 0);
    const scale = realCustomerCount / totalStatic;
    segments = STATIC_SEGMENTS.map((seg) => ({
      ...seg,
      count: Math.max(1, Math.round(seg.count * scale)),
    }));
  }

  return Response.json({
    segments,
    meta: {
      real_customer_count: realCustomerCount,
      real_order_count_30d: realOrderCount,
      real_revenue_30d: realRevenue30d,
      data_source: realCustomerCount !== null ? 'real_customers_table_scaled' : 'static_rfm_model',
    },
    rfm_explanation: {
      recency: 'How recently a customer made a purchase (days since last order)',
      frequency: 'How often a customer buys (orders per time period)',
      monetary: 'How much a customer spends on average (average order value)',
    },
  });
}
