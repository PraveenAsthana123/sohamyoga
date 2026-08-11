// ComplaintAlertJob — Hourly
// Real-time staff alerting for negative-sentiment inbound text, extending
// the Voice of Customer work (weekly digest) with something faster: a
// negative comment/review/message shouldn't wait a week to reach a human.
// Purely deterministic — sentiment is already classified upstream (by
// classifySentiment, called from /api/social/sentiment or the MCP comment-
// read path) before a row ever lands in sentiment_log. This job's only job
// is to notice unalerted negative rows and queue exactly one alert per row,
// never re-alerting the same row twice (alerted_at is set once, checked
// via WHERE alerted_at IS NULL).

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

export async function run(): Promise<void> {
  const tenant = await db.query<{ id: string }>(`SELECT id FROM tenant LIMIT 1`);
  if (!tenant.rowCount) { console.log('[complaint-alert] no tenant configured, skipping'); return; }
  const tenantId = tenant.rows[0].id;

  const admin = await db.query<{ id: string; email: string }>(
    `SELECT id, email FROM app_user WHERE tenant_id=$1 AND role IN ('admin','owner') AND status='active' LIMIT 1`,
    [tenantId],
  );
  if (!admin.rows[0]) { console.log('[complaint-alert] no active admin/owner app_user, skipping'); return; }

  // 48h lookback bounds the backlog a single run will alert on (e.g. after
  // the job was down) without alerting on stale months-old rows.
  const negatives = await db.query<{ id: string; source: string; platform: string | null; text_content: string; reason: string; created_at: string }>(
    `SELECT id, source, platform, text_content, reason, created_at FROM sentiment_log
     WHERE sentiment = 'negative' AND alerted_at IS NULL AND created_at >= now() - interval '48 hours'
     ORDER BY created_at ASC LIMIT 50`,
  );

  let alerted = 0;
  for (const row of negatives.rows) {
    try {
      await db.query(
        `INSERT INTO notification_queue
           (tenant_id, template_slug, channel, type, recipient_user_id, recipient_address, payload, idempotency_key)
         VALUES ($1,'complaint_alert','in_app','alert',$2,$3,$4,$5)
         ON CONFLICT (tenant_id, idempotency_key) DO NOTHING`,
        [
          tenantId, admin.rows[0].id, admin.rows[0].email,
          JSON.stringify({ sentimentLogId: row.id, source: row.source, platform: row.platform, text: row.text_content, reason: row.reason }),
          `complaint_${row.id}`,
        ],
      );
      await db.query(`UPDATE sentiment_log SET alerted_at = now() WHERE id = $1`, [row.id]);
      alerted++;
    } catch (err) {
      console.error(`[complaint-alert] sentiment_log ${row.id}:`, err);
    }
  }

  console.log(`[complaint-alert] alerted=${alerted}/${negatives.rows.length} negative entries`);
  // Do NOT db.end() here — runner.ts caches this module across every
  // scheduled invocation in the long-lived cron container; ending the pool
  // breaks every run after the first.
}
