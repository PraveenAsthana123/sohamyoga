// AffiliatePartnerTierJob — Weekly Sunday 02:00 UTC
// Evaluates every approved affiliate_partner's lifetime_gmv and total_conversions
// against affiliate_tier_rule thresholds. Promotes (or demotes) tier and updates
// commission_rate_bps if custom_rate_override is false. Also flags partners
// with zero conversions in the last 90 days as 'at_risk' in affiliate_event.
// No Ollama dependency — all decisions are rule-based, not AI-generated.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

export async function run(): Promise<void> {
  // Load tier rules ordered highest-to-lowest so we can match greedily
  const tierRules = await db.query<{
    tier: string; min_gmv: string; min_conversions: number; commission_rate_bps: number;
  }>(`SELECT tier, min_gmv, min_conversions, commission_rate_bps FROM affiliate_tier_rule ORDER BY min_gmv DESC`);

  if (!tierRules.rows.length) {
    console.log('[affiliate-tier] No tier rules configured — skipping.');
    return;
  }

  const partners = await db.query<{
    id: string; name: string; tier: string; lifetime_gmv: string;
    total_conversions: number; custom_rate_override: boolean;
  }>(`SELECT id, name, tier, lifetime_gmv, total_conversions, custom_rate_override
      FROM affiliate_partner WHERE status = 'approved'`);

  let promoted = 0;
  let atRisk = 0;

  for (const partner of partners.rows) {
    // Determine correct tier
    let targetTier = 'bronze';
    let targetRateBps = 1000;

    for (const rule of tierRules.rows) {
      if (
        Number(partner.lifetime_gmv) >= Number(rule.min_gmv) &&
        partner.total_conversions >= rule.min_conversions
      ) {
        targetTier = rule.tier;
        targetRateBps = rule.commission_rate_bps;
        break; // highest match wins
      }
    }

    if (partner.tier !== targetTier) {
      const direction = ['bronze', 'silver', 'gold', 'platinum'].indexOf(targetTier) >
        ['bronze', 'silver', 'gold', 'platinum'].indexOf(partner.tier) ? 'promoted' : 'demoted';

      await db.query(
        `UPDATE affiliate_partner
         SET tier = $2,
             commission_rate_bps = CASE WHEN custom_rate_override THEN commission_rate_bps ELSE $3 END,
             updated_at = NOW()
         WHERE id = $1`,
        [partner.id, targetTier, targetRateBps]
      );

      // Log to affiliate_event if table exists
      await db.query(
        `INSERT INTO affiliate_event (vendor_id, kind, amount, reference, actor)
         VALUES ($1::text::uuid, 'tier_change', 0, $2, 'affiliate-tier-job')
         ON CONFLICT DO NOTHING`,
        [partner.id, `${direction}: ${partner.tier} -> ${targetTier}`]
      ).catch(() => {
        // affiliate_event may have different schema — log to stdout as fallback
        console.log(`[affiliate-tier] ${direction} partner ${partner.name}: ${partner.tier} -> ${targetTier}`);
      });

      promoted++;
    }

    // Check at-risk: no conversions in last 90 days (partners with > 0 lifetime conversions)
    if (partner.total_conversions > 0) {
      const recent = await db.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM affiliate_conversion
         WHERE vendor_id = $1::text::uuid AND created_at >= NOW() - INTERVAL '90 days'`,
        [partner.id]
      ).catch(() => ({ rows: [{ count: '0' }] }));

      if (Number(recent.rows[0]?.count ?? 0) === 0) {
        // Flag as at_risk in fraud_flag table
        const dupeCheck = await db.query(
          `SELECT id FROM affiliate_fraud_flag
           WHERE partner_id = $1 AND flag_type = 'at_risk' AND created_at >= NOW() - INTERVAL '30 days'`,
          [partner.id]
        );
        if (!dupeCheck.rowCount) {
          await db.query(
            `INSERT INTO affiliate_fraud_flag (partner_id, flag_type, detail, severity, status)
             VALUES ($1, 'at_risk', $2, 'low', 'open')`,
            [partner.id, JSON.stringify({ reason: 'No conversions in past 90 days', partner_name: partner.name })]
          ).catch(() => {});
          atRisk++;
        }
      }
    }
  }

  console.log(`[affiliate-tier] scanned=${partners.rows.length} tier_changes=${promoted} at_risk_flagged=${atRisk}`);
}
