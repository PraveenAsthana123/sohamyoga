export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export async function GET(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows: monthForecast } = await client.query(`
      SELECT
        COALESCE(SUM(value)::numeric, 0) AS total_pipeline,
        COALESCE(SUM(CASE
          WHEN stage='negotiation' THEN value * 0.75
          WHEN stage='proposal' THEN value * 0.40
          WHEN stage='qualified' THEN value * 0.20
          WHEN stage='prospect' THEN value * 0.05
          ELSE 0 END)::numeric, 0) AS weighted_forecast
      FROM sales_intel_deals
      WHERE close_date >= DATE_TRUNC('month', NOW())
        AND close_date < DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
    `).catch(() => ({ rows: [{ total_pipeline: 0, weighted_forecast: 0 }] }));

    const { rows: quarterForecast } = await client.query(`
      SELECT
        COALESCE(SUM(value)::numeric, 0) AS total_pipeline,
        COALESCE(SUM(CASE
          WHEN stage='negotiation' THEN value * 0.75
          WHEN stage='proposal' THEN value * 0.40
          WHEN stage='qualified' THEN value * 0.20
          WHEN stage='prospect' THEN value * 0.05
          ELSE 0 END)::numeric, 0) AS weighted_forecast
      FROM sales_intel_deals
      WHERE close_date >= DATE_TRUNC('quarter', NOW())
        AND close_date < DATE_TRUNC('quarter', NOW()) + INTERVAL '3 months'
    `).catch(() => ({ rows: [{ total_pipeline: 0, weighted_forecast: 0 }] }));

    return Response.json({
      this_month: { total_pipeline: monthForecast[0]?.total_pipeline ?? 0, weighted_forecast: monthForecast[0]?.weighted_forecast ?? 0 },
      this_quarter: { total_pipeline: quarterForecast[0]?.total_pipeline ?? 0, weighted_forecast: quarterForecast[0]?.weighted_forecast ?? 0 },
    });
  } finally {
    client.release();
  }
}
