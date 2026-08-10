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
  await db.end();
}
