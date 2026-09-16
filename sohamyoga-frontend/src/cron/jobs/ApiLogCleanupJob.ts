// ApiLogCleanupJob — daily 3am (0 3 * * *)
// Deletes old platform monitoring logs per retention policy.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

export async function run(): Promise<void> {
  if (!process.env.DATABASE_URL) return;

  console.log('[api-log-cleanup] Starting cleanup');

  let totalDeleted = 0;

  // Delete platform_api_log rows older than 30 days
  try {
    const apiLogResult = await db.query<{ count: string }>(
      `WITH deleted AS (
         DELETE FROM platform_api_log
         WHERE created_at < NOW() - INTERVAL '30 days'
         RETURNING id
       )
       SELECT COUNT(*) as count FROM deleted`,
    );
    const count = parseInt(apiLogResult.rows[0].count, 10);
    totalDeleted += count;
    console.log(`[api-log-cleanup] Deleted ${count} api_log rows older than 30 days`);
  } catch (err) {
    console.log('[api-log-cleanup] platform_api_log not available:', err instanceof Error ? err.message : String(err));
  }

  // Delete platform_health_check rows older than 7 days
  try {
    const healthResult = await db.query<{ count: string }>(
      `WITH deleted AS (
         DELETE FROM platform_health_check
         WHERE checked_at < NOW() - INTERVAL '7 days'
         RETURNING id
       )
       SELECT COUNT(*) as count FROM deleted`,
    );
    const count = parseInt(healthResult.rows[0].count, 10);
    totalDeleted += count;
    console.log(`[api-log-cleanup] Deleted ${count} health_check rows older than 7 days`);
  } catch (err) {
    console.log('[api-log-cleanup] platform_health_check not available:', err instanceof Error ? err.message : String(err));
  }

  // Delete processed platform_webhook_event rows older than 30 days
  try {
    const webhookResult = await db.query<{ count: string }>(
      `WITH deleted AS (
         DELETE FROM platform_webhook_event
         WHERE received_at < NOW() - INTERVAL '30 days'
           AND processed = true
         RETURNING id
       )
       SELECT COUNT(*) as count FROM deleted`,
    );
    const count = parseInt(webhookResult.rows[0].count, 10);
    totalDeleted += count;
    console.log(`[api-log-cleanup] Deleted ${count} processed webhook_event rows older than 30 days`);
  } catch (err) {
    console.log('[api-log-cleanup] platform_webhook_event not available:', err instanceof Error ? err.message : String(err));
  }

  // Delete succeeded/cancelled retry_queue rows older than 30 days
  try {
    const retryResult = await db.query<{ count: string }>(
      `WITH deleted AS (
         DELETE FROM platform_retry_queue
         WHERE updated_at < NOW() - INTERVAL '30 days'
           AND status IN ('succeeded', 'cancelled')
         RETURNING id
       )
       SELECT COUNT(*) as count FROM deleted`,
    );
    const count = parseInt(retryResult.rows[0].count, 10);
    totalDeleted += count;
    console.log(`[api-log-cleanup] Deleted ${count} completed retry_queue rows older than 30 days`);
  } catch (err) {
    console.log('[api-log-cleanup] platform_retry_queue not available:', err instanceof Error ? err.message : String(err));
  }

  console.log(`[api-log-cleanup] Done. Total deleted: ${totalDeleted} rows`);
  await db.end();
}
