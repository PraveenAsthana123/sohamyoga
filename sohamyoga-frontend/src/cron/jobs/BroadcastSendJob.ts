// BroadcastSendJob — every 10 minutes
// Finds broadcasts with status=scheduled and scheduled_at<=NOW(),
// simulates delivery metrics, and marks them as sent.

import { pool } from '@/lib/db';

export const BroadcastSendJob = {
  name: 'broadcast-send',
  schedule: '*/10 * * * *',
  async run(): Promise<{ ok: boolean; processed: number }> {
    let processed = 0;
    try {
      const due = await pool.query(
        `SELECT * FROM broadcast WHERE status='scheduled' AND scheduled_at <= NOW() LIMIT 20`
      );

      for (const row of due.rows) {
        const recipientCount = row.recipient_count > 0 ? row.recipient_count : Math.floor(Math.random() * 400) + 100;
        const delivered = Math.floor(recipientCount * 0.97);
        const opened = Math.floor(delivered * 0.22);
        const clicked = Math.floor(opened * 0.35);

        await pool.query(
          `UPDATE broadcast SET status='sent', sent_at=NOW(),
           recipient_count=$2, delivered_count=$3, opened_count=$4, clicked_count=$5
           WHERE id=$1`,
          [row.id, recipientCount, delivered, opened, clicked]
        );
        processed++;
      }

      console.log(`[broadcast-send] Processed ${processed} scheduled broadcasts`);
      return { ok: true, processed };
    } catch (err) {
      console.error('[broadcast-send] Error:', err);
      return { ok: false, processed };
    }
  },
};

export async function run() {
  await BroadcastSendJob.run();
}
