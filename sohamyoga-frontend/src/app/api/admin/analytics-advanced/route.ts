import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DayRow { day: string; count?: string; total?: string; }

function computeStats(values: number[]): { min: number; max: number; mean: number; median: number; std_dev: number; trend_pct: number } {
  if (!values.length) return { min: 0, max: 0, mean: 0, median: 0, std_dev: 0, trend_pct: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
  const std_dev = Math.sqrt(variance);
  const last7 = values.slice(-7);
  const prev7 = values.slice(-14, -7);
  const last7Avg = last7.reduce((a, b) => a + b, 0) / (last7.length || 1);
  const prev7Avg = prev7.reduce((a, b) => a + b, 0) / (prev7.length || 1);
  const trend_pct = prev7Avg === 0 ? 0 : ((last7Avg - prev7Avg) / prev7Avg) * 100;
  return { min, max, mean, median, std_dev, trend_pct };
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const [ordersRes, revenueRes, customersRes, pageviewsRes] = await Promise.all([
    pool.query(`SELECT DATE(created_at) as day, COUNT(*) as count FROM sales_order WHERE created_at > NOW() - INTERVAL '90 days' GROUP BY 1 ORDER BY 1`).catch(() => ({ rows: [] as DayRow[] })),
    pool.query(`SELECT DATE(created_at) as day, SUM(total_amount) as total FROM sales_order WHERE created_at > NOW() - INTERVAL '90 days' GROUP BY 1 ORDER BY 1`).catch(() => ({ rows: [] as DayRow[] })),
    pool.query(`SELECT DATE(created_at) as day, COUNT(*) as count FROM customer WHERE created_at > NOW() - INTERVAL '90 days' GROUP BY 1 ORDER BY 1`).catch(() => ({ rows: [] as DayRow[] })),
    pool.query(`SELECT DATE(created_at) as day, COUNT(*) as count FROM customer_event WHERE event_type='pageview' AND created_at > NOW() - INTERVAL '90 days' GROUP BY 1 ORDER BY 1`).catch(() => ({ rows: [] as DayRow[] })),
  ]);

  const orders = ordersRes.rows.map((r) => ({ day: r.day, value: parseInt(r.count || '0') }));
  const revenue = revenueRes.rows.map((r) => ({ day: r.day, value: parseFloat(r.total || '0') }));
  const customers = customersRes.rows.map((r) => ({ day: r.day, value: parseInt(r.count || '0') }));
  const pageviews = pageviewsRes.rows.map((r) => ({ day: r.day, value: parseInt(r.count || '0') }));

  return Response.json({
    timeSeries: { orders, revenue, customers, pageviews },
    stats: {
      orders: computeStats(orders.map((r) => r.value)),
      revenue: computeStats(revenue.map((r) => r.value)),
      customers: computeStats(customers.map((r) => r.value)),
      pageviews: computeStats(pageviews.map((r) => r.value)),
    },
  });
}
