// RetryQueueJob — every 15 minutes (*/15 * * * *)
// Finds pending retry items and attempts them with exponential backoff.
// Simulates 50/50 success/failure for now.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const RETRY_BACKOFF_SECONDS = 60; // base backoff

interface RetryRow {
  id: number;
  platform: string;
  operation_type: string | null;
  payload: Record<string, unknown>;
  attempt_count: number;
  max_attempts: number;
  original_error: string | null;
}

export async function run(): Promise<void> {
  if (!process.env.DATABASE_URL) return;

  // Ensure table exists
  await db.query(`
    CREATE TABLE IF NOT EXISTS platform_retry_queue (
      id SERIAL PRIMARY KEY,
      platform VARCHAR(50) NOT NULL,
      operation_type VARCHAR(50),
      payload JSONB DEFAULT '{}',
      original_error TEXT,
      attempt_count INT DEFAULT 0,
      max_attempts INT DEFAULT 3,
      next_retry_at TIMESTAMPTZ DEFAULT NOW(),
      status VARCHAR(20) DEFAULT 'pending',
      last_error TEXT,
      content_item_id INT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Find items due for retry
  const dueResult = await db.query<RetryRow>(
    `SELECT id, platform, operation_type, payload, attempt_count, max_attempts, original_error
     FROM platform_retry_queue
     WHERE status = 'pending'
       AND next_retry_at <= NOW()
       AND attempt_count < max_attempts
     ORDER BY next_retry_at ASC
     LIMIT 50`,
  );

  if (dueResult.rows.length === 0) {
    console.log('[retry-queue] No items due for retry');
    await db.end();
    return;
  }

  console.log(`[retry-queue] Processing ${dueResult.rows.length} items`);

  let succeeded = 0;
  let failed = 0;
  let exhausted = 0;

  for (const item of dueResult.rows) {
    // Mark as retrying
    await db.query(
      `UPDATE platform_retry_queue
       SET status = 'retrying', attempt_count = attempt_count + 1, updated_at = NOW()
       WHERE id = $1`,
      [item.id],
    );

    // Simulate attempt: 50/50 success/failure
    const success = Math.random() > 0.5;
    const newAttemptCount = item.attempt_count + 1;

    if (success) {
      await db.query(
        `UPDATE platform_retry_queue
         SET status = 'succeeded', last_error = NULL, updated_at = NOW()
         WHERE id = $1`,
        [item.id],
      );
      succeeded++;
      console.log(`[retry-queue] Item ${item.id} (${item.platform}/${item.operation_type}) succeeded on attempt ${newAttemptCount}`);
    } else {
      const simulatedError = `Simulated failure on attempt ${newAttemptCount}`;

      if (newAttemptCount >= item.max_attempts) {
        await db.query(
          `UPDATE platform_retry_queue
           SET status = 'exhausted', last_error = $1, updated_at = NOW()
           WHERE id = $2`,
          [simulatedError, item.id],
        );
        exhausted++;
        console.log(`[retry-queue] Item ${item.id} (${item.platform}/${item.operation_type}) exhausted after ${newAttemptCount} attempts`);
      } else {
        // Exponential backoff: base * 2^attempt_count seconds
        const backoffSeconds = RETRY_BACKOFF_SECONDS * Math.pow(2, newAttemptCount);
        await db.query(
          `UPDATE platform_retry_queue
           SET status = 'pending',
               last_error = $1,
               next_retry_at = NOW() + ($2 || ' seconds')::INTERVAL,
               updated_at = NOW()
           WHERE id = $3`,
          [simulatedError, backoffSeconds.toString(), item.id],
        );
        failed++;
        console.log(`[retry-queue] Item ${item.id} (${item.platform}/${item.operation_type}) failed, next retry in ${backoffSeconds}s`);
      }
    }
  }

  console.log(`[retry-queue] Done. succeeded=${succeeded} failed_backoff=${failed} exhausted=${exhausted}`);
  await db.end();
}
