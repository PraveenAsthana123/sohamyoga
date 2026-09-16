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
    const { rows: dealStages } = await client.query(`
      SELECT stage, COUNT(*)::int AS count, COALESCE(SUM(value)::numeric, 0) AS total_value
      FROM sales_intel_deals
      GROUP BY stage
      ORDER BY CASE stage
        WHEN 'prospect' THEN 1 WHEN 'qualified' THEN 2 WHEN 'proposal' THEN 3
        WHEN 'negotiation' THEN 4 WHEN 'closed_won' THEN 5 WHEN 'closed_lost' THEN 6
        ELSE 7 END
    `).catch(() => ({ rows: [] }));

    const { rows: leadStages } = await client.query(`
      SELECT status AS stage, COUNT(*)::int AS count
      FROM lead_management_leads
      GROUP BY status
      ORDER BY count DESC
    `).catch(() => ({ rows: [] }));

    const { rows: recentDeals } = await client.query(`
      SELECT id, name, stage, value, close_date, created_at
      FROM sales_intel_deals
      ORDER BY created_at DESC
      LIMIT 10
    `).catch(() => ({ rows: [] }));

    return Response.json({ deal_stages: dealStages, lead_stages: leadStages, recent_deals: recentDeals });
  } finally {
    client.release();
  }
}
