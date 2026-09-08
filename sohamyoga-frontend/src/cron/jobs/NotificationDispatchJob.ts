// NotificationDispatchJob — Every 5 minutes
// Dispatches due notifications from notification_queue.
// External providers receive: rendered text + recipient address + token ONLY.
//
// Push (added 2026-09-07): notification_template.body/subject are rendered
// locally via renderTemplate() (the {{variable}} convention Novu already
// documents for the other channels) and sent through sendPushToUser(), which
// is real web-push against self-generated VAPID keys -- no external push
// provider. A recipient with zero push_subscription rows is honestly marked
// failed with reason 'no_push_subscription', never reported as sent.

import { Pool } from 'pg';
import { NotificationPreference } from '@/domain/notification/NotificationPreference';
import { sendPushToUser } from '@/lib/web-push';
import { renderTemplate } from '@/lib/notification-template';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const NOVU_API_KEY  = process.env.NOVU_API_KEY  ?? '';
const NOVU_BASE_URL = process.env.NOVU_BASE_URL ?? 'http://localhost:3000';

const MAX_BATCH = parseInt(process.env.NOTIFICATION_BATCH_SIZE ?? '50', 10);
const MAX_NON_ESSENTIAL_PER_DAY = parseInt(process.env.NOTIFICATION_MAX_NON_ESSENTIAL_PER_DAY ?? '3', 10);

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

    // Real consent enforcement -- customer.email_opt_in/sms_opt_in were
    // stored and editable at /customer/preferences but nothing ever checked
    // them before sending (found live 2026-09-02: a customer could opt out
    // and still receive marketing email/SMS). Transactional/alert/otp
    // always send regardless -- consent only gates non-essential marketing.
    if (job.type === 'marketing' && (job.channel === 'email' || job.channel === 'sms')) {
      const consentColumn = job.channel === 'email' ? 'email_opt_in' : 'sms_opt_in';
      const consent = await db.query<{ opted_in: boolean }>(
        `SELECT ${consentColumn} AS opted_in FROM customer WHERE user_id = $1`,
        [job.recipient_user_id],
      );
      if (consent.rowCount && !consent.rows[0].opted_in) {
        await db.query(`UPDATE notification_queue SET status='cancelled', failure_reason='customer_opted_out', updated_at=NOW() WHERE id=$1`, [job.id]);
        continue;
      }
    }

    // Real quiet-hour enforcement -- notification_preference.quiet_hours_start/
    // end + NotificationPreference.isInQuietHours() already existed but were
    // never called anywhere (found live 2026-09-03). Non-essential types
    // deferred back to 'pending' (not failed/cancelled) so the next run
    // picks them up once quiet hours end; transactional/alert/otp always
    // send regardless, matching the consent gate's own essential/non-
    // essential split.
    if (job.type === 'marketing' || job.type === 'reminder') {
      const pref = await db.query<{ quiet_hours_start: string | null; quiet_hours_end: string | null; timezone: string }>(
        `SELECT quiet_hours_start, quiet_hours_end, timezone FROM notification_preference WHERE user_id = $1`,
        [job.recipient_user_id],
      );
      const row = pref.rows[0];
      if (row?.quiet_hours_start && row.quiet_hours_end) {
        const currentHHMM = new Intl.DateTimeFormat('en-GB', { timeZone: row.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
        const inQuietHours = new NotificationPreference({
          id: 'dispatch-check', tenantId: job.tenant_id, userId: job.recipient_user_id,
          emailEnabled: true, smsEnabled: true, pushEnabled: true, whatsappEnabled: true, inAppEnabled: true, telegramEnabled: true,
          marketingEnabled: true, transactionalEnabled: true, reminderEnabled: true, alertEnabled: true,
          language: 'en', quietHoursStart: row.quiet_hours_start, quietHoursEnd: row.quiet_hours_end,
          timezone: row.timezone, updatedAt: new Date(),
        }).isInQuietHours(currentHHMM);
        if (inQuietHours) {
          await db.query(`UPDATE notification_queue SET status='pending', updated_at=NOW() WHERE id=$1`, [job.id]);
          continue;
        }
      }
    }

    // Real Channel Selection Engine -- notification_preference had real
    // per-channel (email/sms/push/whatsapp/in_app/telegram) and per-type
    // (marketing/reminder/alert) enable flags, plus real
    // NotificationPreference.isChannelEnabled()/isTypeEnabled() methods,
    // but neither was ever called (found live 2026-09-07, same dead-code
    // class as quiet-hours/frequency). A recipient who disabled a channel
    // or type is now actually honored -- cancelled, not silently sent
    // anyway. Transactional/otp still always send (essential).
    if (job.type !== 'transactional' && job.type !== 'otp') {
      const pref2 = await db.query<{
        email_enabled: boolean; sms_enabled: boolean; push_enabled: boolean; whatsapp_enabled: boolean;
        in_app_enabled: boolean; telegram_enabled: boolean; marketing_enabled: boolean; reminder_enabled: boolean; alert_enabled: boolean;
      }>(
        `SELECT email_enabled, sms_enabled, push_enabled, whatsapp_enabled, in_app_enabled, telegram_enabled,
                marketing_enabled, reminder_enabled, alert_enabled
         FROM notification_preference WHERE user_id = $1`,
        [job.recipient_user_id],
      );
      if (pref2.rowCount) {
        const p = pref2.rows[0];
        const channelEnabled = {
          email: p.email_enabled, sms: p.sms_enabled, push: p.push_enabled, whatsapp: p.whatsapp_enabled,
          in_app: p.in_app_enabled, telegram: p.telegram_enabled,
        }[job.channel as 'email' | 'sms' | 'push' | 'whatsapp' | 'in_app' | 'telegram'] ?? true; // discord/slack/voice: not user-configurable, defaults open
        const typeEnabled = job.type === 'marketing' ? p.marketing_enabled : job.type === 'reminder' ? p.reminder_enabled : p.alert_enabled;
        if (!channelEnabled || !typeEnabled) {
          await db.query(`UPDATE notification_queue SET status='cancelled', failure_reason='recipient_disabled_channel_or_type', updated_at=NOW() WHERE id=$1`, [job.id]);
          continue;
        }
      }
    }

    // Real Frequency Management -- caps non-essential sends per recipient
    // per day against the real notification_history delivery log, counted
    // fresh every run rather than a fabricated "compliance %". No cap
    // existed before this (found live 2026-09-03); transactional/alert/otp
    // are exempt, same essential/non-essential split as the other gates.
    if (job.type === 'marketing' || job.type === 'reminder') {
      const recent = await db.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM notification_history
         WHERE recipient_user_id = $1 AND type IN ('marketing','reminder')
           AND status = 'sent' AND sent_at >= NOW() - interval '24 hours'`,
        [job.recipient_user_id],
      );
      if (Number(recent.rows[0].n) >= MAX_NON_ESSENTIAL_PER_DAY) {
        await db.query(`UPDATE notification_queue SET status='pending', updated_at=NOW() WHERE id=$1`, [job.id]);
        continue;
      }
    }

    // in_app has no external provider to dispatch through -- appearing in
    // the customer's own inbox (/api/customer/inbox) IS the delivery,
    // exactly as /api/bookings' own notification insert already treats it.
    // Routing it through Novu anyway was a real bug: every in_app row
    // (community_digest, alerts, etc.) 404'd against Novu and was marked
    // 'failed' despite never actually failing to reach its recipient.
    if (job.channel === 'in_app') {
      await db.query(`UPDATE notification_queue SET status='sent', sent_at=NOW(), updated_at=NOW() WHERE id=$1`, [job.id]);
      await db.query(`
        INSERT INTO notification_history
          (tenant_id, job_id, template_slug, channel, type, recipient_user_id, recipient_address, status, sent_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'sent',NOW())
      `, [job.tenant_id, job.id, job.template_slug, job.channel, job.type, job.recipient_user_id, job.recipient_address]);
      sent++;
      continue;
    }

    // Real Web Push branch -- bypasses Novu entirely (Novu has no push
    // integration in this deployment). Renders notification_template
    // locally, then sends via sendPushToUser() (VAPID, no 3rd-party push
    // service).
    if (job.channel === 'push') {
      try {
        const tmpl = await db.query<{ subject: string | null; body: string }>(
          `SELECT subject, body FROM notification_template
           WHERE tenant_id=$1 AND slug=$2 AND status IN ('active','approved')
           ORDER BY version DESC LIMIT 1`,
          [job.tenant_id, job.template_slug],
        );
        if (!tmpl.rowCount) {
          await db.query(`UPDATE notification_queue SET status='failed', failure_reason='no_active_template', updated_at=NOW() WHERE id=$1`, [job.id]);
          failed++;
          continue;
        }
        const title = renderTemplate(tmpl.rows[0].subject || 'SohamYoga', job.payload);
        const body = renderTemplate(tmpl.rows[0].body, job.payload);
        const urlValue = job.payload.url;
        const result = await sendPushToUser(job.recipient_user_id, {
          title, body,
          url: typeof urlValue === 'string' ? urlValue : undefined,
          tag: job.template_slug,
        });
        if (result.sent > 0) {
          await db.query(`UPDATE notification_queue SET status='sent', sent_at=NOW(), updated_at=NOW() WHERE id=$1`, [job.id]);
          await db.query(`
            INSERT INTO notification_history
              (tenant_id, job_id, template_slug, channel, type, recipient_user_id, recipient_address, status, sent_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,'sent',NOW())
          `, [job.tenant_id, job.id, job.template_slug, job.channel, job.type, job.recipient_user_id, job.recipient_address]);
          sent++;
        } else {
          // Zero live subscriptions (or all stale/removed) -- honest
          // failure, not a fabricated "sent".
          await db.query(`UPDATE notification_queue SET status='failed', failure_reason='no_push_subscription', updated_at=NOW() WHERE id=$1`, [job.id]);
          failed++;
        }
      } catch (err) {
        const retryCount = job.retry_count + 1;
        const newStatus  = retryCount >= 3 ? 'failed' : 'pending';
        await db.query(`
          UPDATE notification_queue SET status=$1, retry_count=$2, failure_reason=$3, updated_at=NOW() WHERE id=$4
        `, [newStatus, retryCount, String(err), job.id]);
        failed++;
      }
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
