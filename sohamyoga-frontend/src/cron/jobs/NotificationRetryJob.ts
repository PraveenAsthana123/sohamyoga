// NotificationRetryJob — Hourly :00
// Retries failed notifications that haven't exceeded MAX_NOTIFICATION_RETRIES=3.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

export async function run(): Promise<void> {
  const result = await db.query(`
    UPDATE notification_queue
    SET status = 'pending', updated_at = NOW()
    WHERE status = 'failed'
      AND retry_count < 3
      AND updated_at < NOW() - INTERVAL '15 minutes'
    RETURNING id
  `);

  if (result.rowCount ?? 0 > 0)
    console.log(`[notification-retry] re-queued=${result.rowCount}`);
  // Do NOT db.end() here — runner.ts dynamically imports this module once
  // and Node caches it, so every scheduled invocation reuses this same
  // module-scope pool. Ending it after the first run breaks every run after
  // that ("Cannot use a pool after calling end on the pool") — confirmed via
  // this exact error in the live cron container's logs.
}
