// NotificationDispatchJob — Every 5 minutes
// Dispatches due notifications from notification_queue.
// External providers receive: rendered text + recipient address + token ONLY.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const NOVU_API_KEY  = process.env.NOVU_API_KEY  ?? '';
const NOVU_BASE_URL = process.env.NOVU_BASE_URL ?? 'http://localhost:3000';

const MAX_BATCH = parseInt(process.env.NOTIFICATION_BATCH_SIZE ?? '50', 10);

export async function run(): Promise<void> {
  // Pick up to MAX_BATCH due jobs (pending or scheduled and due now)
  const jobs = await db.query<{
    id: string; tenant_id: string; recipient_id: string; channel: string;
    template_slug: string; payload: Record<string, unknown>;
    scheduled_at: Date | null; retry_count: number;
  }>(`
    SELECT id, tenant_id, recipient_id, channel, template_slug, payload,
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

    // Check suppression list
    const suppressed = await db.query<{ id: string }>(`
      SELECT id FROM suppression_list
      WHERE tenant_id=$1 AND channel=$2
        AND address = (SELECT email FROM student WHERE id=$3 LIMIT 1)
      LIMIT 1
    `, [job.tenant_id, job.channel, job.recipient_id]);

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
          to:          { subscriberId: job.recipient_id },
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

        // Record in history
        await db.query(`
          INSERT INTO notification_history (queue_id, channel, template_slug, sent_at)
          VALUES ($1, $2, $3, NOW())
        `, [job.id, job.channel, job.template_slug]);

        sent++;
      } else {
        throw new Error(`Novu HTTP ${res.status}`);
      }
    } catch (err) {
      const retryCount = job.retry_count + 1;
      const newStatus  = retryCount >= 3 ? 'failed' : 'pending';
      await db.query(`
        UPDATE notification_queue
        SET status=$1, retry_count=$2, last_error=$3, updated_at=NOW()
        WHERE id=$4
      `, [newStatus, retryCount, String(err), job.id]);
      failed++;
    }
  }

  if (sent + failed > 0)
    console.log(`[notification-dispatch] sent=${sent} failed=${failed}`);
  await db.end();
}
