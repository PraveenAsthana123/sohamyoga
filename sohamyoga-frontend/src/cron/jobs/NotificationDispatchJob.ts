// NotificationDispatchJob — Every 5 minutes
// Dispatches due notifications from notification_queue.
// External providers receive: rendered text + recipient address + token ONLY.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const NOVU_API_KEY  = process.env.NOVU_API_KEY  ?? '';
const NOVU_BASE_URL = process.env.NOVU_BASE_URL ?? 'http://localhost:3000';

const MAX_BATCH = parseInt(process.env.NOTIFICATION_BATCH_SIZE ?? '50', 10);

export async function run(): Promise<void> {
  // Pick up to MAX_BATCH due jobs (pending or scheduled and due now).
  // Column names match the live notification_queue schema exactly —
  // recipient_user_id/recipient_address/type/failure_reason, not the
  // recipient_id/last_error this job previously (and incorrectly) assumed,
  // which made every single run fail with "column does not exist".
  const jobs = await db.query<{
    id: string; tenant_id: string; recipient_user_id: string; recipient_address: string;
    channel: string; type: string; template_slug: string; payload: Record<string, unknown>;
    scheduled_at: Date | null; retry_count: number;
  }>(`
    SELECT id, tenant_id, recipient_user_id, recipient_address, channel, type, template_slug, payload,
           scheduled_at, retry_count
    FROM notification_queue
    WHERE status IN ('pending','scheduled')
      AND (scheduled_at IS NULL OR scheduled_at <= NOW())
      AND retry_count < 3
    ORDER BY created_at ASC
    LIMIT $1
    FOR UPDATE SKIP LOCKED
  `, [MAX_BATCH]);

  let sent = 0, failed = 0;

  for (const job of jobs.rows) {
    // Mark processing
    await db.query(`UPDATE notification_queue SET status='processing', updated_at=NOW() WHERE id=$1`, [job.id]);

    // Check suppression list — the queue row already carries the resolved
    // address, so no join back through student is needed (and would be
    // wrong: recipient_user_id is a user id, not a student id).
    const suppressed = await db.query<{ id: string }>(`
      SELECT id FROM suppression_list
      WHERE tenant_id=$1 AND channel=$2 AND address=$3
      LIMIT 1
    `, [job.tenant_id, job.channel, job.recipient_address]);

    if (suppressed.rows.length > 0) {
      await db.query(`UPDATE notification_queue SET status='cancelled', updated_at=NOW() WHERE id=$1`, [job.id]);
      continue;
    }

    try {
      // Dispatch via Novu (self-hosted) — only sends rendered text + address
      const res = await fetch(`${NOVU_BASE_URL}/v1/events/trigger`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `ApiKey ${NOVU_API_KEY}`,
        },
        body: JSON.stringify({
          name:        job.template_slug,
          to:          { subscriberId: job.recipient_user_id, email: job.recipient_address },
          payload:     job.payload,
          overrides:   { [job.channel]: {} },
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        const data = await res.json() as { transactionId?: string };
        await db.query(`
          UPDATE notification_queue
          SET status='sent', provider_message_id=$1, sent_at=NOW(), updated_at=NOW()
          WHERE id=$2
        `, [data.transactionId ?? null, job.id]);

        // Record in history — job_id, not queue_id; and type/recipient_*
        // are NOT NULL on notification_history too.
        await db.query(`
          INSERT INTO notification_history
            (tenant_id, job_id, template_slug, channel, type, recipient_user_id, recipient_address, status, sent_at, provider_message_id)
          VALUES ($1,$2,$3,$4,$5,$6,$7,'sent',NOW(),$8)
        `, [job.tenant_id, job.id, job.template_slug, job.channel, job.type,
            job.recipient_user_id, job.recipient_address, data.transactionId ?? null]);

        sent++;
      } else {
        throw new Error(`Novu HTTP ${res.status}`);
      }
    } catch (err) {
      const retryCount = job.retry_count + 1;
      const newStatus  = retryCount >= 3 ? 'failed' : 'pending';
      await db.query(`
        UPDATE notification_queue
        SET status=$1, retry_count=$2, failure_reason=$3, updated_at=NOW()
        WHERE id=$4
      `, [newStatus, retryCount, String(err), job.id]);
      failed++;
    }
  }

  if (sent + failed > 0)
    console.log(`[notification-dispatch] sent=${sent} failed=${failed}`);
  // Do NOT db.end() here — see NotificationRetryJob.ts for why: this module
  // is cached and reused across every scheduled invocation in the long-lived
  // cron runner, so ending the pool here breaks every run after the first.
}
