import { NextRequest } from 'next/server';
import { getPool } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    // Listing stats
    const listingStats = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE status != 'deleted') AS total_listings,
        COUNT(*) FILTER (WHERE status = 'draft') AS draft,
        COUNT(*) FILTER (WHERE status = 'ready') AS ready,
        COUNT(*) FILTER (WHERE status = 'posted') AS posted,
        COUNT(*) FILTER (WHERE status = 'expired') AS expired
      FROM kijiji_listings
    `);

    // By category
    const byCategory = await client.query(`
      SELECT category, COUNT(*) AS count
      FROM kijiji_listings
      WHERE status != 'deleted'
      GROUP BY category
      ORDER BY count DESC
    `);

    // Lead stats (table may not exist yet — handle gracefully)
    let totalLeads = 0;
    let leadsNew = 0, leadsContacted = 0, leadsQualified = 0, leadsLost = 0;
    try {
      const leadStats = await client.query(`
        SELECT
          COUNT(*) AS total_leads,
          COUNT(*) FILTER (WHERE status = 'new') AS new,
          COUNT(*) FILTER (WHERE status = 'contacted') AS contacted,
          COUNT(*) FILTER (WHERE status = 'qualified') AS qualified,
          COUNT(*) FILTER (WHERE status = 'lost') AS lost
        FROM kijiji_leads
      `);
      const ls = leadStats.rows[0];
      totalLeads = Number(ls.total_leads);
      leadsNew = Number(ls.new);
      leadsContacted = Number(ls.contacted);
      leadsQualified = Number(ls.qualified);
      leadsLost = Number(ls.lost);
    } catch {
      // Table not yet created — leads still at zero
    }

    // Top listing by views
    const topRow = await client.query(`
      SELECT title, views_count, responses_count
      FROM kijiji_listings
      WHERE status = 'posted'
      ORDER BY views_count DESC
      LIMIT 1
    `);

    // Avg response rate across posted listings
    const rateRow = await client.query(`
      SELECT
        AVG(CASE WHEN views_count > 0 THEN (responses_count::float / views_count) * 100 ELSE 0 END) AS avg_rate
      FROM kijiji_listings
      WHERE status = 'posted'
    `);

    const s = listingStats.rows[0];

    return Response.json({
      total_listings: Number(s.total_listings),
      by_status: {
        draft: Number(s.draft),
        ready: Number(s.ready),
        posted: Number(s.posted),
        expired: Number(s.expired),
      },
      by_category: byCategory.rows.map(r => ({ category: r.category, count: Number(r.count) })),
      total_leads: totalLeads,
      leads_by_status: {
        new: leadsNew,
        contacted: leadsContacted,
        qualified: leadsQualified,
        lost: leadsLost,
      },
      top_listing: topRow.rows[0]
        ? {
            title: topRow.rows[0].title,
            views_count: Number(topRow.rows[0].views_count),
            responses_count: Number(topRow.rows[0].responses_count),
          }
        : null,
      avg_response_rate: Number((Number(rateRow.rows[0]?.avg_rate) || 0).toFixed(1)),
    });
  } finally {
    client.release();
  }
}
