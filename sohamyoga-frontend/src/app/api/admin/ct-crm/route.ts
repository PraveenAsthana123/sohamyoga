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
    const [dealsRes, leadsRes, consultRes] = await Promise.all([
      client.query(`
        SELECT
          COUNT(*)::int AS total,
          COALESCE(SUM(value)::numeric, 0) AS pipeline_value,
          COALESCE(AVG(value)::numeric, 0) AS avg_deal_size,
          COUNT(*) FILTER (WHERE close_date >= DATE_TRUNC('month', NOW()) AND close_date < DATE_TRUNC('month', NOW()) + INTERVAL '1 month')::int AS closing_this_month
        FROM sales_intel_deals
      `).catch(() => ({ rows: [{ total: 0, pipeline_value: 0, avg_deal_size: 0, closing_this_month: 0 }] })),

      client.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status='qualified' OR status='mql')::int AS qualified
        FROM lead_management_leads
      `).catch(() => ({ rows: [{ total: 0, qualified: 0 }] })),

      client.query(`
        SELECT COUNT(*)::int AS total, COALESCE(SUM(value)::numeric,0) AS value FROM consulting_opportunities WHERE status != 'closed_lost'
      `).catch(() => ({ rows: [{ total: 0, value: 0 }] })),
    ]);

    const deals = dealsRes.rows[0] ?? { total: 0, pipeline_value: 0, avg_deal_size: 0, closing_this_month: 0 };
    const leads = leadsRes.rows[0] ?? { total: 0, qualified: 0 };
    const consult = consultRes.rows[0] ?? { total: 0, value: 0 };

    const totalPipeline = Number(deals.pipeline_value) + Number(consult.value);
    const conversionRate = leads.total > 0 ? Math.round((leads.qualified / leads.total) * 100) : 0;

    const pipelineScore = totalPipeline > 10000 ? 34 : totalPipeline > 1000 ? 20 : 0;
    const leadScore = conversionRate >= 20 ? 33 : conversionRate >= 10 ? 20 : 0;
    const dealScore = deals.closing_this_month > 0 ? 33 : 0;
    const health_score = Math.min(100, pipelineScore + leadScore + dealScore);

    return Response.json({
      health_score,
      traffic_light: health_score >= 70 ? 'green' : health_score >= 40 ? 'yellow' : 'red',
      kpis: [
        { label: 'Pipeline Value', value: `$${Math.round(totalPipeline).toLocaleString()}`, target: 50000, trend: totalPipeline >= 20000 ? 'up' : 'down', unit: '' },
        { label: 'Qualified Leads', value: leads.qualified, target: 20, trend: leads.qualified >= 10 ? 'up' : 'down', unit: 'leads' },
        { label: 'Closing This Month', value: deals.closing_this_month, target: 3, trend: deals.closing_this_month >= 2 ? 'up' : 'down', unit: 'deals' },
        { label: 'Avg Deal Size', value: `$${Math.round(Number(deals.avg_deal_size)).toLocaleString()}`, target: 5000, trend: Number(deals.avg_deal_size) >= 3000 ? 'up' : 'down', unit: '' },
        { label: 'Lead Conversion', value: conversionRate, target: 20, trend: conversionRate >= 20 ? 'up' : 'down', unit: '%' },
      ],
      updated_at: new Date().toISOString(),
    });
  } finally {
    client.release();
  }
}
