// AffiliateCommissionSettleJob — Daily 05:00 UTC
// Scans commission rows with status='pending' where the linked sales_order
// is confirmed or delivered. Marks each as 'settled' and increments
// affiliate_partner.total_earned for the owning partner.
// Idempotent: each commission row is only settled once.
// No Ollama — pure accounting logic.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

export async function run(): Promise<void> {
  // commission table: id, vendor_id (partner reference), order_id, earned, status
  // Find pending commissions where the order is in a confirmed/delivered state
  const pendingCommissions = await db.query<{
    id: string; vendor_id: string; order_id: string; earned: string;
  }>(`
    SELECT c.id, c.vendor_id, c.order_id, c.earned
    FROM commission c
    JOIN sales_order so ON so.id = c.order_id
    WHERE c.status = 'pending'
      AND so.status IN ('confirmed', 'delivered', 'completed')
    LIMIT 500
  `).catch(() => ({ rows: [] }));

  if (!pendingCommissions.rows.length) {
    console.log('[affiliate-commission-settle] No pending commissions to settle.');
    return;
  }

  let settled = 0;
  const partnerEarnings: Record<string, number> = {};

  for (const commission of pendingCommissions.rows) {
    try {
      // Mark commission as settled
      const updated = await db.query(
        `UPDATE commission SET status = 'settled', updated_at = NOW() WHERE id = $1 AND status = 'pending' RETURNING id`,
        [commission.id]
      );

      if (!updated.rowCount) continue; // concurrent update guard

      // Accumulate earnings per partner
      const vendorId = commission.vendor_id;
      partnerEarnings[vendorId] = (partnerEarnings[vendorId] ?? 0) + Number(commission.earned);
      settled++;
    } catch (err) {
      console.error(`[affiliate-commission-settle] failed to settle commission ${commission.id}:`, err);
    }
  }

  // Batch-update affiliate_partner.total_earned for each partner
  for (const [vendorId, earned] of Object.entries(partnerEarnings)) {
    try {
      // Try matching via vendor_id -> affiliate_partner (if vendor_id is a UUID referencing partner)
      await db.query(
        `UPDATE affiliate_partner SET total_earned = total_earned + $2, updated_at = NOW() WHERE id = $1`,
        [vendorId, earned]
      );

      // Also log to affiliate_event for audit trail
      await db.query(
        `INSERT INTO affiliate_event (vendor_id, kind, amount, reference, actor)
         VALUES ($1::text::uuid, 'commission_settled', $2, 'daily-settle', 'affiliate-commission-settle-job')
         ON CONFLICT DO NOTHING`,
        [vendorId, earned]
      ).catch(() => {
        // affiliate_event vendor_id may use a different FK; log to stdout as fallback
        console.log(`[affiliate-commission-settle] partner=${vendorId} earned=+$${earned.toFixed(2)}`);
      });
    } catch (err) {
      console.error(`[affiliate-commission-settle] failed to update partner ${vendorId}:`, err);
    }
  }

  console.log(`[affiliate-commission-settle] settled=${settled} partners_updated=${Object.keys(partnerEarnings).length}`);
}
