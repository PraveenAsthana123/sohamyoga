import { NextRequest } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS affiliate_partner (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      website TEXT,
      social_handles JSONB DEFAULT '{}',
      niche TEXT,
      audience_size INTEGER DEFAULT 0,
      tier TEXT DEFAULT 'bronze',
      status TEXT DEFAULT 'pending',
      commission_rate_bps INTEGER DEFAULT 1000,
      custom_rate_override BOOLEAN DEFAULT false,
      total_clicks INTEGER DEFAULT 0,
      total_conversions INTEGER DEFAULT 0,
      total_earned NUMERIC(12,2) DEFAULT 0,
      total_paid NUMERIC(12,2) DEFAULT 0,
      lifetime_gmv NUMERIC(12,2) DEFAULT 0,
      cookie_window_days INTEGER DEFAULT 30,
      sub_affiliate_of UUID REFERENCES affiliate_partner(id),
      application_notes TEXT,
      rejection_reason TEXT,
      approved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS affiliate_tier_rule (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tier TEXT NOT NULL,
      min_gmv NUMERIC(12,2) DEFAULT 0,
      min_conversions INTEGER DEFAULT 0,
      commission_rate_bps INTEGER NOT NULL,
      sub_commission_rate_bps INTEGER DEFAULT 200,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS affiliate_payout (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      partner_id UUID REFERENCES affiliate_partner(id),
      period TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL,
      status TEXT DEFAULT 'pending',
      payment_method TEXT,
      payment_reference TEXT,
      paid_at TIMESTAMPTZ,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS affiliate_material (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      format TEXT,
      platform TEXT,
      file_url TEXT,
      copy_text TEXT,
      cta_text TEXT,
      utm_preset TEXT,
      is_active BOOLEAN DEFAULT true,
      download_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS affiliate_fraud_flag (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      partner_id UUID REFERENCES affiliate_partner(id),
      flag_type TEXT NOT NULL,
      detail JSONB DEFAULT '{}',
      severity TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'open',
      reviewed_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS affiliate_campaign (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      bonus_rate_bps INTEGER DEFAULT 0,
      start_date TIMESTAMPTZ,
      end_date TIMESTAMPTZ,
      target_product_ids UUID[] DEFAULT '{}',
      min_sale_amount NUMERIC(10,2) DEFAULT 0,
      status TEXT DEFAULT 'draft',
      total_conversions INTEGER DEFAULT 0,
      total_bonus_paid NUMERIC(12,2) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Seed tier rules
  await query(`
    INSERT INTO affiliate_tier_rule (tier, min_gmv, min_conversions, commission_rate_bps, sub_commission_rate_bps, description)
    SELECT * FROM (VALUES
      ('bronze',   0::numeric,      0,  1000, 200, 'Entry level — 10% commission, 2% sub-affiliate'),
      ('silver',   5000::numeric,   25, 1200, 300, 'Growing — 12% commission, 3% sub-affiliate'),
      ('gold',     25000::numeric,  100,1500, 400, 'High performer — 15% commission, 4% sub-affiliate'),
      ('platinum', 100000::numeric, 500,2000, 500, 'Elite — 20% commission, 5% sub-affiliate')
    ) AS v(tier, min_gmv, min_conversions, commission_rate_bps, sub_commission_rate_bps, description)
    WHERE NOT EXISTS (SELECT 1 FROM affiliate_tier_rule LIMIT 1)
  `);

  // Seed demo partners
  await query(`
    INSERT INTO affiliate_partner (name, email, website, niche, audience_size, tier, status, commission_rate_bps)
    SELECT * FROM (VALUES
      ('Yoga Wellness Blog', 'partner1@example.com', 'https://yogawellness.example.com', 'yoga', 15000, 'silver', 'approved', 1200),
      ('FitLife Influencer', 'partner2@example.com', 'https://fitlife.example.com', 'fitness', 45000, 'gold', 'approved', 1500),
      ('MindBody Coach', 'partner3@example.com', 'https://mindbody.example.com', 'wellness', 8000, 'bronze', 'pending', 1000)
    ) AS v(name, email, website, niche, audience_size, tier, status, commission_rate_bps)
    WHERE NOT EXISTS (SELECT 1 FROM affiliate_partner LIMIT 1)
  `);

  // Seed materials
  await query(`
    INSERT INTO affiliate_material (title, type, format, platform, copy_text, cta_text, utm_preset)
    SELECT * FROM (VALUES
      ('Summer Yoga Sale Banner', 'banner', '728x90', 'general', '', 'Start Your Journey', 'utm_source=affiliate&utm_medium=banner&utm_campaign=summer'),
      ('Instagram Post Copy — Wellness', 'social_copy', 'square', 'instagram', 'Transform your mind and body with expert-led yoga classes. Use my link for 20% off your first month! #yoga #wellness', 'Get 20% Off', 'utm_source=affiliate&utm_medium=social&utm_campaign=wellness'),
      ('Email Template — Class Promo', 'email_copy', null, 'email', 'Subject: Your friend thinks you should try yoga!\n\nHi [Name],\n\nI wanted to share something that has truly changed my life — online yoga classes from SohamYoga. Use my referral link to get your first class free!\n\n[CTA_BUTTON: Start Free Class]\n\nNamaste,\n[Partner Name]', 'Start Free Class', 'utm_source=affiliate&utm_medium=email&utm_campaign=referral')
    ) AS v(title, type, format, platform, copy_text, cta_text, utm_preset)
    WHERE NOT EXISTS (SELECT 1 FROM affiliate_material LIMIT 1)
  `);
}

async function access(req: NextRequest) {
  const auth = await getAdminPrincipal(req);
  if (auth.denied) return auth;
  if (!databaseConfigured()) return { denied: Response.json({ error: 'Database unavailable.' }, { status: 503 }) };
  return auth;
}

export async function GET(req: NextRequest) {
  const auth = await access(req);
  if (auth.denied) return auth.denied;
  await ensureSchema();

  const url = new URL(req.url);
  const tier = url.searchParams.get('tier');
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('search');

  let sql = `SELECT p.*,
    (p.total_earned - p.total_paid) AS outstanding_balance,
    CASE WHEN p.total_clicks > 0 THEN ROUND((p.total_conversions::numeric / p.total_clicks) * 100, 2) ELSE 0 END AS conv_rate
    FROM affiliate_partner p WHERE 1=1`;
  const params: unknown[] = [];
  let i = 1;

  if (tier) { sql += ` AND p.tier = $${i++}`; params.push(tier); }
  if (status) { sql += ` AND p.status = $${i++}`; params.push(status); }
  if (search) { sql += ` AND (p.name ILIKE $${i} OR p.email ILIKE $${i})`; params.push(`%${search}%`); i++; }

  sql += ` ORDER BY p.created_at DESC`;

  const partners = await query(sql, params);

  const [tiers, stats] = await Promise.all([
    query(`SELECT * FROM affiliate_tier_rule ORDER BY min_gmv ASC`),
    query(`
      SELECT
        COUNT(*) FILTER (WHERE status='approved') AS active_count,
        COUNT(*) FILTER (WHERE status='pending') AS pending_count,
        COUNT(*) AS total_count,
        COALESCE(SUM(lifetime_gmv), 0) AS total_gmv,
        COALESCE(SUM(total_earned), 0) AS total_earned,
        COALESCE(SUM(total_paid), 0) AS total_paid,
        COALESCE(SUM(total_earned - total_paid), 0) AS outstanding,
        CASE WHEN COUNT(*) > 0 THEN ROUND(AVG(commission_rate_bps)::numeric / 100, 2) ELSE 0 END AS avg_rate_pct
      FROM affiliate_partner
    `),
  ]);

  return Response.json({
    partners: partners.rows,
    tiers: tiers.rows,
    stats: stats.rows[0] ?? {},
  });
}

export async function POST(req: NextRequest) {
  const auth = await access(req);
  if (auth.denied) return auth.denied;
  await ensureSchema();

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request.' }, { status: 400 });

  if (body.action === 'create') {
    const { name, email, website, niche, audience_size, tier, commission_rate_bps, application_notes } = body;
    if (!name || !email) return Response.json({ error: 'Name and email required.' }, { status: 400 });
    const result = await query(
      `INSERT INTO affiliate_partner (name, email, website, niche, audience_size, tier, commission_rate_bps, application_notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, email, website || null, niche || null, audience_size || 0, tier || 'bronze', commission_rate_bps || 1000, application_notes || null]
    );
    return Response.json({ ok: true, partner: result.rows[0] });
  }

  if (body.action === 'approve') {
    if (!body.id) return Response.json({ error: 'Partner ID required.' }, { status: 400 });
    const result = await query(
      `UPDATE affiliate_partner SET status='approved', approved_at=NOW(), updated_at=NOW() WHERE id=$1 RETURNING *`,
      [body.id]
    );
    return result.rowCount ? Response.json({ ok: true, partner: result.rows[0] }) : Response.json({ error: 'Not found.' }, { status: 404 });
  }

  if (body.action === 'reject') {
    if (!body.id) return Response.json({ error: 'Partner ID required.' }, { status: 400 });
    const result = await query(
      `UPDATE affiliate_partner SET status='rejected', rejection_reason=$2, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [body.id, body.rejection_reason || null]
    );
    return result.rowCount ? Response.json({ ok: true, partner: result.rows[0] }) : Response.json({ error: 'Not found.' }, { status: 404 });
  }

  if (body.action === 'suspend') {
    if (!body.id) return Response.json({ error: 'Partner ID required.' }, { status: 400 });
    const result = await query(
      `UPDATE affiliate_partner SET status='suspended', updated_at=NOW() WHERE id=$1 RETURNING *`,
      [body.id]
    );
    return result.rowCount ? Response.json({ ok: true, partner: result.rows[0] }) : Response.json({ error: 'Not found.' }, { status: 404 });
  }

  if (body.action === 'promote_tiers') {
    const tiers = await query(`SELECT * FROM affiliate_tier_rule ORDER BY min_gmv DESC`);
    let promoted = 0;
    const partners = await query(`SELECT id, lifetime_gmv, total_conversions, tier FROM affiliate_partner WHERE status='approved'`);
    for (const p of partners.rows) {
      for (const t of tiers.rows) {
        if (Number(p.lifetime_gmv) >= Number(t.min_gmv) && p.total_conversions >= t.min_conversions) {
          if (p.tier !== t.tier) {
            await query(
              `UPDATE affiliate_partner SET tier=$2, commission_rate_bps=$3, updated_at=NOW() WHERE id=$1 AND custom_rate_override=false`,
              [p.id, t.tier, t.commission_rate_bps]
            );
            promoted++;
          }
          break;
        }
      }
    }
    return Response.json({ ok: true, promoted });
  }

  return Response.json({ error: 'Unknown action.' }, { status: 400 });
}
