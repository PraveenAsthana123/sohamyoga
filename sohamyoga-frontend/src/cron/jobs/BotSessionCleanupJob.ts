// BotSessionCleanupJob — runs daily at 02:00
// Closes bot sessions that have been idle for more than 24 hours.

import { pool } from '@/lib/db';

export const BotSessionCleanupJob = {
  name: 'bot-session-cleanup',
  schedule: '0 2 * * *',
  async run(): Promise<{ ok: boolean; closed: number }> {
    try {
      const result = await pool.query(
        `UPDATE bot_session
         SET resolved=true
         WHERE resolved=false
           AND last_message_at < NOW() - INTERVAL '24 hours'`
      );
      const closed = result.rowCount ?? 0;
      console.log(`[bot-session-cleanup] Closed ${closed} stale sessions`);
      return { ok: true, closed };
    } catch (err) {
      console.error('[bot-session-cleanup] Error:', err);
      return { ok: false, closed: 0 };
    }
  },
};

export async function run() {
  await BotSessionCleanupJob.run();
}
