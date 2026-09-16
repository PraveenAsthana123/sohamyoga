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
    const { rows: stages } = await client.query(`
      SELECT stage, COUNT(*)::int AS count,
             ROUND(AVG(touchpoints_count)::numeric, 1) AS avg_touchpoints,
             ROUND(AVG(nps_score)::numeric, 1) AS avg_nps
      FROM omnichannel_journeys
      GROUP BY stage
      ORDER BY CASE stage
        WHEN 'awareness' THEN 1 WHEN 'consideration' THEN 2 WHEN 'acquisition' THEN 3
        WHEN 'retention' THEN 4 WHEN 'loyalty' THEN 5 WHEN 'advocacy' THEN 6
        ELSE 7 END
    `).catch(() => ({ rows: [] }));

    const { rows: journeys } = await client.query(`
      SELECT id, customer_id, stage, channels_used, touchpoints_count, last_interaction, nps_score
      FROM omnichannel_journeys
      ORDER BY last_interaction DESC
      LIMIT 20
    `).catch(() => ({ rows: [] }));

    return Response.json({ stages, journeys });
  } finally {
    client.release();
  }
}
