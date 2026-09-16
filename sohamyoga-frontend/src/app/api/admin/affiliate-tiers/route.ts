import { NextRequest } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

async function access(req: NextRequest) {
  const auth = await getAdminPrincipal(req);
  if (auth.denied) return auth;
  if (!databaseConfigured()) return { denied: Response.json({ error: 'Database unavailable.' }, { status: 503 }) };
  return auth;
}

export async function GET(req: NextRequest) {
  const auth = await access(req);
  if (auth.denied) return auth.denied;

  const [tiers, cusp] = await Promise.all([
    query(`SELECT * FROM affiliate_tier_rule ORDER BY min_gmv ASC`),
    query(`
      SELECT p.id, p.name, p.email, p.tier, p.lifetime_gmv, p.total_conversions,
        (SELECT tier FROM affiliate_tier_rule WHERE min_gmv <= p.lifetime_gmv AND min_conversions <= p.total_conversions ORDER BY min_gmv DESC LIMIT 1) AS current_eligible_tier,
        (SELECT min_gmv FROM affiliate_tier_rule WHERE min_gmv > p.lifetime_gmv ORDER BY min_gmv ASC LIMIT 1) AS next_tier_gmv_threshold,
        (SELECT tier FROM affiliate_tier_rule WHERE min_gmv > p.lifetime_gmv ORDER BY min_gmv ASC LIMIT 1) AS next_tier
      FROM affiliate_partner p
      WHERE p.status = 'approved'
      ORDER BY p.lifetime_gmv DESC
    `),
  ]);

  return Response.json({ tiers: tiers.rows, partners_cusp: cusp.rows });
}

export async function POST(req: NextRequest) {
  const auth = await access(req);
  if (auth.denied) return auth.denied;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request.' }, { status: 400 });

  const { tier, min_gmv, min_conversions, commission_rate_bps, sub_commission_rate_bps, description } = body;
  if (!tier || commission_rate_bps == null) {
    return Response.json({ error: 'Tier and commission_rate_bps required.' }, { status: 400 });
  }

  // Upsert by tier name
  const existing = await query(`SELECT id FROM affiliate_tier_rule WHERE tier = $1`, [tier]);
  if (existing.rowCount) {
    const result = await query(
      `UPDATE affiliate_tier_rule SET min_gmv=$2, min_conversions=$3, commission_rate_bps=$4, sub_commission_rate_bps=$5, description=$6 WHERE tier=$1 RETURNING *`,
      [tier, min_gmv || 0, min_conversions || 0, commission_rate_bps, sub_commission_rate_bps || 200, description || null]
    );
    return Response.json({ ok: true, tier: result.rows[0] });
  } else {
    const result = await query(
      `INSERT INTO affiliate_tier_rule (tier, min_gmv, min_conversions, commission_rate_bps, sub_commission_rate_bps, description) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [tier, min_gmv || 0, min_conversions || 0, commission_rate_bps, sub_commission_rate_bps || 200, description || null]
    );
    return Response.json({ ok: true, tier: result.rows[0] }, { status: 201 });
  }
}
