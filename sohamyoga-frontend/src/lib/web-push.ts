// Real Web Push send primitive, backed by the `web-push` package and
// self-generated VAPID keys (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
// / VAPID_SUBJECT — see .env.template). No third-party push service: this
// sends directly to each browser's own push endpoint (Chrome -> FCM, Firefox
// -> Mozilla autopush, etc.) using standard Web Push protocol + VAPID auth.
//
// This module is deliberately just the sendable primitive — a future job
// (see src/cron/jobs/NotificationDispatchJob.ts) can call sendPushToUser()
// once it has a rendered title/body for a queued notification. Wiring a real
// 'push' branch into that job was left out of this change: the job today
// dispatches by forwarding notification_queue.payload (raw template
// variables) to Novu for external rendering — it never renders
// notification_template.body itself anywhere in this codebase, so a honest
// push branch would need real template interpolation added first rather
// than guessing at a payload shape. See NotificationDispatchJob.ts's header
// comment for the follow-up.

import webpush, { type PushSubscription, type SendResult } from 'web-push';
import { query } from './postgres';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
}

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export function pushConfigured(): boolean {
  return ensureConfigured();
}

/** Send one payload to one stored subscription row. */
export async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
): Promise<SendResult> {
  if (!ensureConfigured()) throw new Error('VAPID keys are not configured (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT).');
  const pushSubscription: PushSubscription = {
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.p256dh, auth: subscription.auth },
  };
  return webpush.sendNotification(pushSubscription, JSON.stringify(payload));
}

/**
 * Send to every device a user has subscribed on. Stale subscriptions (the
 * push service returns 404/410 once a browser has actually unsubscribed,
 * e.g. after a profile wipe or long-expired token) are deleted so the
 * table stays honest instead of accumulating dead rows forever.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<{ sent: number; removed: number; failed: number }> {
  const rows = await query<{ id: string; endpoint: string; p256dh: string; auth: string }>(
    `SELECT id, endpoint, p256dh, auth FROM push_subscription WHERE user_id = $1`,
    [userId],
  );

  let sent = 0, removed = 0, failed = 0;
  for (const row of rows.rows) {
    try {
      await sendPushNotification(row, payload);
      sent++;
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await query(`DELETE FROM push_subscription WHERE id = $1`, [row.id]);
        removed++;
      } else {
        failed++;
      }
    }
  }
  return { sent, removed, failed };
}
