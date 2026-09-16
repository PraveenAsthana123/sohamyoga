import { NextRequest } from 'next/server';
import { databaseConfigured, getPool } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ENSURE_TABLE = `
  CREATE TABLE IF NOT EXISTS affiliate_click_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_code TEXT NOT NULL,
    affiliate_name TEXT,
    landing_page TEXT,
    referrer_url TEXT,
    utm_source TEXT,
    device_type TEXT,
    country TEXT,
    converted BOOLEAN DEFAULT false,
    order_id UUID,
    commission_earned NUMERIC(10,2),
    clicked_at TIMESTAMPTZ DEFAULT NOW()
  )
`;

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  try {
    const pool = getPool();
    await pool.query(ENSURE_TABLE);

    const [overview, byAffiliate, byCountry, dailyTrend] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) as total_clicks,
          COUNT(*) FILTER (WHERE converted=true) as conversions,
          COALESCE(SUM(commission_earned),0) as total_commission,
          ROUND(COUNT(*) FILTER (WHERE converted=true)::numeric / NULLIF(COUNT(*),0) * 100, 1) as conversion_rate_pct
        FROM affiliate_click_log
        WHERE clicked_at > NOW() - INTERVAL '30 days'
      `),
      pool.query(`
        SELECT
          affiliate_code, affiliate_name,
          COUNT(*) as clicks,
          COUNT(*) FILTER (WHERE converted=true) as conversions,
          COALESCE(SUM(commission_earned),0) as commission_earned,
          ROUND(COUNT(*) FILTER (WHERE converted=true)::numeric / NULLIF(COUNT(*),0) * 100, 1) as conv_rate_pct
        FROM affiliate_click_log
        WHERE clicked_at > NOW() - INTERVAL '30 days'
        GROUP BY affiliate_code, affiliate_name
        ORDER BY clicks DESC
        LIMIT 20
      `),
      pool.query(`
        SELECT country, COUNT(*) as clicks, COUNT(*) FILTER (WHERE converted=true) as conversions
        FROM affiliate_click_log
        WHERE country IS NOT NULL AND clicked_at > NOW() - INTERVAL '30 days'
        GROUP BY country ORDER BY clicks DESC LIMIT 10
      `),
      pool.query(`
        SELECT DATE(clicked_at) as day, COUNT(*) as clicks, COUNT(*) FILTER (WHERE converted=true) as conversions
        FROM affiliate_click_log
        WHERE clicked_at > NOW() - INTERVAL '30 days'
        GROUP BY day ORDER BY day ASC
      `),
    ]);

    const ov = overview.rows[0] ?? {};

    return Response.json({
      overview: {
        total_clicks: parseInt(ov.total_clicks ?? '0', 10),
        conversions: parseInt(ov.conversions ?? '0', 10),
        conversion_rate: `${ov.conversion_rate_pct ?? '0'}%`,
        total_commission: parseFloat(ov.total_commission ?? '0').toFixed(2),
      },
      by_affiliate: byAffiliate.rows,
      by_country: byCountry.rows,
      daily_trend: dailyTrend.rows,
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
