import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const [overall, byTier] = await Promise.all([
    query<{ avg: string | null; p90: string | null }>(
      `SELECT AVG(lifetime_spend_cad) AS avg,
              PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY lifetime_spend_cad) AS p90
       FROM customer WHERE lifetime_spend_cad > 0`,
    ),
    query<{ tier: string; p25: string | null; median: string | null; p90: string | null }>(
      `SELECT tier,
              PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY lifetime_spend_cad) AS p25,
              PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY lifetime_spend_cad) AS median,
              PERCENTILE_CONT(0.9)  WITHIN GROUP (ORDER BY lifetime_spend_cad) AS p90
       FROM customer WHERE lifetime_spend_cad > 0 GROUP BY tier ORDER BY median DESC NULLS LAST`,
    ),
  ]);

  return Response.json({
    avgClv: overall.rows[0]?.avg ? Math.round(Number(overall.rows[0].avg)) : 0,
    top10PctClv: overall.rows[0]?.p90 ? Math.round(Number(overall.rows[0].p90)) : 0,
    byTier: byTier.rows.map(r => ({
      tier: r.tier,
      p25: r.p25 ? Math.round(Number(r.p25)) : 0,
      median: r.median ? Math.round(Number(r.median)) : 0,
      p90: r.p90 ? Math.round(Number(r.p90)) : 0,
    })),
  });
}
