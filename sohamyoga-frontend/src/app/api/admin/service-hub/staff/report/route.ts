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
    const { rows } = await client.query('SELECT * FROM staff_utilization ORDER BY utilization_pct DESC');
    const avg = rows.reduce((s, r) => s + Number(r.utilization_pct), 0) / Math.max(rows.length, 1);
    const over = rows.filter(r => Number(r.utilization_pct) > 100);
    const under = rows.filter(r => Number(r.utilization_pct) < 75);
    return Response.json({
      avg_utilization: avg.toFixed(1),
      over_utilized: over,
      under_utilized: under,
      all_staff: rows,
      summary: `Team avg ${avg.toFixed(0)}% utilization. ${over.length} staff over capacity, ${under.length} under 75%.`,
    });
  } finally { client.release(); }
}
