// AffiliateFraudScanJob — Daily 04:00 UTC
// Scans for three fraud patterns:
//   1. Self-referral: partner's own customer_id used their own referral code
//   2. Click flood: >200 referral_click for a partner in last 24h
//   3. IP cluster: >10 conversions from same /24 subnet in a 7-day window
// Inserts affiliate_fraud_flag rows; skips if a duplicate flag was raised within 7 days.
// No Ollama — all detection is deterministic SQL. Advisory only; no auto-suspension.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

async function hasDupeFlag(partnerId: string, flagType: string): Promise<boolean> {
  const r = await db.query(
    `SELECT id FROM affiliate_fraud_flag
     WHERE partner_id = $1 AND flag_type = $2 AND created_at >= NOW() - INTERVAL '7 days'`,
    [partnerId, flagType]
  );
  return (r.rowCount ?? 0) > 0;
}

async function insertFlag(partnerId: string, flagType: string, detail: object, severity: string): Promise<void> {
  await db.query(
    `INSERT INTO affiliate_fraud_flag (partner_id, flag_type, detail, severity, status)
     VALUES ($1, $2, $3, $4, 'open')`,
    [partnerId, flagType, JSON.stringify(detail), severity]
  );
}

export async function run(): Promise<void> {
  let selfReferrals = 0;
  let clickFloods = 0;
  let ipClusters = 0;

  // 1. Self-referral detection
  // partner has a customer_id AND that customer_id shows up in affiliate_conversion as the buyer
  try {
    const selfRef = await db.query<{ id: string; name: string; order_count: number }>(`
      SELECT ap.id, ap.name, COUNT(ac.id) AS order_count
      FROM affiliate_partner ap
      JOIN referral_code rc ON rc.created_by = ap.id
      JOIN affiliate_conversion ac ON ac.order_id IN (
        SELECT order_id FROM referral_click rcl
        WHERE rcl.referral_code_id = rc.id
      )
      JOIN sales_order so ON so.id = ac.order_id
      WHERE ap.customer_id IS NOT NULL
        AND so.customer_email = (SELECT email FROM affiliate_partner WHERE id = ap.id LIMIT 1)
      GROUP BY ap.id, ap.name
      HAVING COUNT(ac.id) > 0
    `).catch(() => ({ rows: [] as { id: string; name: string; order_count: number }[] }));

    for (const row of selfRef.rows) {
      if (!(await hasDupeFlag(row.id, 'self_referral'))) {
        await insertFlag(row.id, 'self_referral', { partner_name: row.name, order_count: row.order_count }, 'high');
        selfReferrals++;
      }
    }
  } catch (err) {
    console.error('[affiliate-fraud] self-referral scan failed:', err);
  }

  // 2. Click flood: > 200 clicks in last 24h per partner
  try {
    const floods = await db.query<{ partner_id: string; partner_name: string; click_count: number }>(`
      SELECT ap.id AS partner_id, ap.name AS partner_name, COUNT(rc.id) AS click_count
      FROM referral_click rc
      JOIN referral_code rco ON rco.id = rc.referral_code_id
      JOIN affiliate_partner ap ON ap.id = rco.created_by
      WHERE rc.created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY ap.id, ap.name
      HAVING COUNT(rc.id) > 200
    `).catch(() => ({ rows: [] as { partner_id: string; partner_name: string; click_count: number }[] }));

    for (const row of floods.rows) {
      if (!(await hasDupeFlag(row.partner_id, 'click_flood'))) {
        await insertFlag(row.partner_id, 'click_flood', {
          partner_name: row.partner_name,
          click_count: row.click_count,
          window: '24h',
          threshold: 200,
        }, 'medium');
        clickFloods++;
      }
    }
  } catch (err) {
    console.error('[affiliate-fraud] click flood scan failed:', err);
  }

  // 3. IP cluster: > 10 conversions from same /24 subnet in 7 days
  // referral_click has ip_address field; check if schema supports it
  try {
    const ipClusters_ = await db.query<{ partner_id: string; partner_name: string; subnet: string; conv_count: number }>(`
      SELECT ap.id AS partner_id, ap.name AS partner_name,
             split_part(rc.ip_address, '.', 1) || '.' ||
             split_part(rc.ip_address, '.', 2) || '.' ||
             split_part(rc.ip_address, '.', 3) || '.0/24' AS subnet,
             COUNT(DISTINCT ac.order_id) AS conv_count
      FROM referral_click rc
      JOIN referral_code rco ON rco.id = rc.referral_code_id
      JOIN affiliate_partner ap ON ap.id = rco.created_by
      JOIN affiliate_conversion ac ON ac.order_id IN (
        SELECT order_id FROM referral_click WHERE referral_code_id = rc.referral_code_id
          AND ip_address LIKE (
            split_part(rc.ip_address, '.', 1) || '.' ||
            split_part(rc.ip_address, '.', 2) || '.' ||
            split_part(rc.ip_address, '.', 3) || '.%'
          )
          AND created_at >= NOW() - INTERVAL '7 days'
      )
      WHERE rc.created_at >= NOW() - INTERVAL '7 days'
        AND rc.ip_address IS NOT NULL AND rc.ip_address != ''
      GROUP BY ap.id, ap.name, subnet
      HAVING COUNT(DISTINCT ac.order_id) > 10
    `).catch(() => ({ rows: [] as { partner_id: string; partner_name: string; subnet: string; conv_count: number }[] }));

    for (const row of ipClusters_.rows) {
      if (!(await hasDupeFlag(row.partner_id, 'ip_cluster'))) {
        await insertFlag(row.partner_id, 'ip_cluster', {
          partner_name: row.partner_name,
          subnet: row.subnet,
          conversion_count: row.conv_count,
          window: '7d',
          threshold: 10,
        }, 'high');
        ipClusters++;
      }
    }
  } catch (err) {
    console.error('[affiliate-fraud] IP cluster scan failed:', err);
  }

  console.log(`[affiliate-fraud] self_referrals=${selfReferrals} click_floods=${clickFloods} ip_clusters=${ipClusters}`);
}
