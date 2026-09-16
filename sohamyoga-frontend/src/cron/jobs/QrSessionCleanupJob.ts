// QrSessionCleanupJob — hourly
// Expires QR challenge tokens that are still 'pending' past their expiresAt
// timestamp. Prevents stale pending rows from accumulating in qr_login_challenge
// (or equivalent table) over time.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

export async function run(): Promise<void> {
  // Expire rows that are still pending but past their TTL.
  // The table name matches the QrLoginChallenge domain entity convention.
  const result = await db.query(`
    UPDATE qr_login_challenge
    SET status = 'expired'
    WHERE status = 'pending'
      AND expires_at <= now()
  `);

  const expired = result.rowCount ?? 0;
  console.log(`[qr-session-cleanup] expired=${expired}`);
  // Do NOT db.end() — pool is shared across the cron process lifetime.
}
