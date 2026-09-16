// AffiliatePayoutJob — Monthly 1st of month 03:00 UTC
// Finds all approved affiliate_partner rows where (total_earned - total_paid) > 10.00
// and creates affiliate_payout rows with status='pending' for the previous month's period.
// Does NOT transfer any money — the payout record is a trigger for the admin to process
// the actual bank/PayPal transfer. Admin marks as paid via /admin/affiliates?tab=payouts.
// Idempotent: will not create duplicate payout rows for the same partner+period.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

function lastMonthPeriod(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function run(): Promise<void> {
  const period = lastMonthPeriod();

  const eligible = await db.query<{
    id: string; name: string; email: string; total_earned: string; total_paid: string;
  }>(`
    SELECT id, name, email, total_earned, total_paid
    FROM affiliate_partner
    WHERE status = 'approved'
      AND (total_earned - total_paid) > 10.00
  `);

  if (!eligible.rows.length) {
    console.log(`[affiliate-payout] period=${period} no eligible partners`);
    return;
  }

  let created = 0;
  let skipped = 0;

  for (const partner of eligible.rows) {
    const balance = Number(partner.total_earned) - Number(partner.total_paid);

    // Check for existing payout this period
    const existing = await db.query(
      `SELECT id FROM affiliate_payout WHERE partner_id = $1 AND period = $2`,
      [partner.id, period]
    );

    if (existing.rowCount) {
      skipped++;
      continue;
    }

    await db.query(
      `INSERT INTO affiliate_payout (partner_id, period, amount, status)
       VALUES ($1, $2, $3, 'pending')`,
      [partner.id, period, balance.toFixed(2)]
    );

    // Log to affiliate_event
    await db.query(
      `INSERT INTO affiliate_event (vendor_id, kind, amount, reference, actor)
       VALUES ($1::text::uuid, 'payout_queued', $2, $3, 'affiliate-payout-job')
       ON CONFLICT DO NOTHING`,
      [partner.id, balance, `Payout queued for period ${period}`]
    ).catch(() => {
      console.log(`[affiliate-payout] queued ${partner.email} $${balance.toFixed(2)} for ${period}`);
    });

    created++;
  }

  console.log(`[affiliate-payout] period=${period} eligible=${eligible.rows.length} created=${created} skipped=${skipped}`);
}
