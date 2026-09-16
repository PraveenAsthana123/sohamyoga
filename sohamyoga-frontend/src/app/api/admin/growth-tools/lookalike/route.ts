import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureSchema(pool: ReturnType<typeof getPool>) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lookalike_audiences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      platform TEXT NOT NULL,
      source_type TEXT DEFAULT 'customer_list',
      source_size INT,
      lookalike_size_pct NUMERIC(4,2) DEFAULT 1.0,
      country TEXT DEFAULT 'CA',
      estimated_reach INT,
      status TEXT DEFAULT 'draft',
      campaign_linked TEXT,
      performance_json JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  const { rowCount } = await pool.query(`SELECT 1 FROM lookalike_audiences LIMIT 1`);
  if (!rowCount) {
    await pool.query(`
      INSERT INTO lookalike_audiences
        (name, platform, source_type, source_size, lookalike_size_pct, country, estimated_reach, status, campaign_linked, performance_json)
      VALUES
        ('Yoga Class Buyers – FB 1%', 'facebook', 'customer_list', 4200, 1.00, 'CA', 390000, 'active', 'Spring Promotion 2026', '{"impressions":124000,"clicks":3900,"conversions":210,"cpa":18.50}'),
        ('Website Visitors – Google 2%', 'google', 'website_visitors', 18000, 2.00, 'CA', 760000, 'ready', NULL, '{"impressions":0,"clicks":0,"conversions":0,"cpa":0}'),
        ('App Users – LinkedIn 1%', 'linkedin', 'app_users', 1100, 1.00, 'CA', 145000, 'creating', NULL, '{}'),
        ('Video Viewers 50% – TikTok 1%', 'tiktok', 'video_viewers', 32000, 1.00, 'CA', 510000, 'active', 'Brand Awareness Q3', '{"impressions":299000,"clicks":14200,"conversions":88,"cpa":27.30}'),
        ('Lead Form – Pinterest 3%', 'pinterest', 'lead_form', 870, 3.00, 'CA', 95000, 'draft', NULL, '{}'),
        ('Engagement – Facebook 2%', 'facebook', 'engagement', 9500, 2.00, 'US', 6400000, 'active', 'US Expansion', '{"impressions":410000,"clicks":9800,"conversions":340,"cpa":12.80}');
    `);
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  await ensureSchema(pool);
  const { rows } = await pool.query(`
    SELECT * FROM lookalike_audiences ORDER BY created_at DESC
  `);
  const kpi = {
    total: rows.length,
    active: rows.filter((r) => r.status === 'active').length,
    totalReach: rows.reduce((s: number, r: { estimated_reach: number }) => s + (r.estimated_reach || 0), 0),
    bestPlatform: (() => {
      const counts: Record<string, number> = {};
      rows.forEach((r: { platform: string }) => { counts[r.platform] = (counts[r.platform] || 0) + 1; });
      return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    })(),
  };
  return Response.json({ audiences: rows, kpi });
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  if (!body || !body.name || !body.platform) {
    return Response.json({ error: 'name and platform are required' }, { status: 400 });
  }
  const pool = getPool();
  await ensureSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO lookalike_audiences
      (name, platform, source_type, source_size, lookalike_size_pct, country, estimated_reach, status, campaign_linked)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'draft',$8)
     RETURNING *`,
    [
      body.name,
      body.platform,
      body.source_type || 'customer_list',
      body.source_size || null,
      body.lookalike_size_pct || 1.0,
      body.country || 'CA',
      body.estimated_reach || null,
      body.campaign_linked || null,
    ],
  );
  return Response.json({ audience: rows[0] }, { status: 201 });
}
