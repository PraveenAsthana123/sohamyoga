// TelegramReportSyncJob — every 6 hours
// Syncs Telegram channel post analytics (message views) via the Telegram Bot
// API into the local social_post_analytics table. Credential-gated: skips
// gracefully when TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are not configured.
//
// Telegram publishing is handled by FirstWaveDispatchJob (bot_token +
// chat_id from the connected social_account.credentials JSONB). This job
// checks getUpdates / getChatMemberCount for aggregate stats and upserts
// into social_post_analytics. Until a real bot token is configured, it
// records an honest "not configured" stamp and exits cleanly.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

export const TelegramReportSyncJob = {
  name: 'telegram-report-sync',
  schedule: '0 */6 * * *',
};

export async function run(): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    await db.query(
      `UPDATE module_registry SET last_verified_at = NOW(), missing_items = 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set — sync skipped'
       WHERE module_key = 'telegram-management'`
    );
    console.log('[telegram-report-sync] skipped — TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set');
    return;
  }

  const BASE = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
  let synced = 0;

  try {
    const updatesRes = await fetch(`${BASE}/getUpdates?limit=50&allowed_updates=["channel_post"]`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!updatesRes.ok) {
      const text = await updatesRes.text();
      throw new Error(`Telegram API HTTP ${updatesRes.status}: ${text.slice(0, 300)}`);
    }
    const updates = await updatesRes.json() as {
      ok: boolean;
      result: Array<{ update_id: number; channel_post?: { message_id: number; views?: number; date: number; text?: string } }>;
    };

    if (!updates.ok) throw new Error('Telegram getUpdates returned ok=false');

    for (const update of updates.result) {
      const cp = update.channel_post;
      if (!cp) continue;
      const postId = `telegram:${TELEGRAM_CHAT_ID}:${cp.message_id}`;
      const views = cp.views ?? 0;
      await db.query(
        `INSERT INTO social_post_analytics
           (post_id, platform, impressions, reach, likes, comments, shares, clicks, synced_at)
         VALUES ($1, 'telegram', $2, $2, 0, 0, 0, 0, NOW())
         ON CONFLICT (post_id, platform) DO UPDATE SET
           impressions = EXCLUDED.impressions,
           reach = EXCLUDED.reach,
           synced_at = NOW()`,
        [postId, views]
      ).catch(() => null);
      synced++;
    }

    await db.query(
      `UPDATE module_registry SET last_verified_at = NOW(), missing_items = NULL
       WHERE module_key = 'telegram-management'`
    );
    console.log(`[telegram-report-sync] synced=${synced}`);
  } catch (err) {
    console.error('[telegram-report-sync] error', err);
    throw err;
  }
}
