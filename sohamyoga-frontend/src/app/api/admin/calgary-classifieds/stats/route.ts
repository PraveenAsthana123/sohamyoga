import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALL_PLATFORMS = [
  'kijiji','craigslist','facebook_marketplace','usedcalgary',
  'calgary_herald','zumper','autotrader','realtor_ca','oodle','indeed',
];

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const [totalsRes, byStatusRes, byCategoryRes, byNeighbourhoodRes,
      platformRawRes, totalLeadsRes, leadsByPlatformRes, bestRes] = await Promise.all([
      client.query(`SELECT COUNT(*) AS total FROM calgary_listing`),
      client.query(`
        SELECT status, COUNT(*) AS count FROM calgary_listing
        GROUP BY status
      `),
      client.query(`
        SELECT category, COUNT(*) AS count FROM calgary_listing
        GROUP BY category ORDER BY count DESC
      `),
      client.query(`
        SELECT neighbourhood, COUNT(*) AS count FROM calgary_listing
        WHERE neighbourhood IS NOT NULL
        GROUP BY neighbourhood ORDER BY count DESC
      `),
      client.query(`
        SELECT platform,
          COUNT(*) FILTER (WHERE status='posted') AS posted,
          COUNT(*) FILTER (WHERE status='pending') AS pending,
          COUNT(*) FILTER (WHERE status='failed') AS failed
        FROM calgary_listing_platform
        GROUP BY platform
      `),
      client.query(`SELECT COUNT(*) AS total FROM calgary_classifieds_lead`),
      client.query(`
        SELECT platform, COUNT(*) AS count FROM calgary_classifieds_lead
        WHERE platform IS NOT NULL
        GROUP BY platform ORDER BY count DESC
      `),
      client.query(`
        SELECT cl.title,
          COALESCE(SUM(p.views_count),0) AS total_views,
          COALESCE(SUM(p.responses_count),0) AS total_responses,
          COALESCE(SUM(p.views_count),0) + COALESCE(SUM(p.responses_count),0) AS combined
        FROM calgary_listing cl
        LEFT JOIN calgary_listing_platform p ON p.listing_id = cl.id
        GROUP BY cl.id, cl.title
        ORDER BY combined DESC
        LIMIT 1
      `),
    ]);

    const byStatus: Record<string, number> = {};
    for (const r of byStatusRes.rows) byStatus[r.status] = Number(r.count);

    // Fill in zeros for all known statuses
    for (const s of ['draft','active','paused','sold','expired']) {
      byStatus[s] = byStatus[s] ?? 0;
    }

    // Build platform coverage map, fill in platforms with no rows
    const platformMap: Record<string, { posted: number; pending: number; failed: number }> = {};
    for (const p of ALL_PLATFORMS) platformMap[p] = { posted: 0, pending: 0, failed: 0 };
    for (const r of platformRawRes.rows) {
      platformMap[r.platform] = {
        posted: Number(r.posted),
        pending: Number(r.pending),
        failed: Number(r.failed),
      };
    }
    const platform_coverage = ALL_PLATFORMS.map(p => ({ platform: p, ...platformMap[p] }));

    return Response.json({
      total_listings: Number(totalsRes.rows[0].total),
      by_status: byStatus,
      by_category: byCategoryRes.rows.map(r => ({ category: r.category, count: Number(r.count) })),
      by_neighbourhood: byNeighbourhoodRes.rows.map(r => ({ neighbourhood: r.neighbourhood, count: Number(r.count) })),
      platform_coverage,
      total_leads: Number(totalLeadsRes.rows[0].total),
      leads_by_platform: leadsByPlatformRes.rows.map(r => ({ platform: r.platform, count: Number(r.count) })),
      best_performing: bestRes.rows[0]
        ? {
            listing_title: bestRes.rows[0].title,
            total_views: Number(bestRes.rows[0].total_views),
            total_responses: Number(bestRes.rows[0].total_responses),
          }
        : null,
    });
  } finally {
    client.release();
  }
}
