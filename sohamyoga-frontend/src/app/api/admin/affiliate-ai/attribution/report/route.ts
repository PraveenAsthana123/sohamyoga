export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT * FROM affiliate_attribution ORDER BY revenue DESC');
    const totalRevenue = rows.reduce((s, r) => s + Number(r.revenue), 0);

    // Aggregate by partner across models
    const firstTouch: Record<string, number> = {};
    const lastTouch: Record<string, number> = {};
    const linear: Record<string, number> = {};
    const timeDecay: Record<string, number> = {};

    rows.forEach(r => {
      if (r.first_touch_partner) firstTouch[r.first_touch_partner] = (firstTouch[r.first_touch_partner] || 0) + Number(r.revenue);
      if (r.last_touch_partner) lastTouch[r.last_touch_partner] = (lastTouch[r.last_touch_partner] || 0) + Number(r.revenue);
      if (r.linear_credit) {
        const lc = r.linear_credit as Record<string, number>;
        Object.entries(lc).forEach(([p, pct]) => { linear[p] = (linear[p] || 0) + (Number(r.revenue) * Number(pct) / 100); });
      }
      if (r.time_decay_credit) {
        const td = r.time_decay_credit as Record<string, number>;
        Object.entries(td).forEach(([p, pct]) => { timeDecay[p] = (timeDecay[p] || 0) + (Number(r.revenue) * Number(pct) / 100); });
      }
    });

    return Response.json({
      total_revenue: totalRevenue,
      total_conversions: rows.length,
      avg_touchpoints: rows.reduce((s, r) => s + (Array.isArray(r.touchpoints) ? r.touchpoints.length : 0), 0) / Math.max(rows.length, 1),
      first_touch_attribution: firstTouch,
      last_touch_attribution: lastTouch,
      linear_attribution: linear,
      time_decay_attribution: timeDecay,
      records: rows,
    });
  } finally { client.release(); }
}
