import { NextRequest } from 'next/server';
import { databaseConfigured, query, transaction } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_STATUSES = new Set(['DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED']);
// V1 scope, stated honestly: only email and push are wired to a real send
// path here (the two channels this codebase already queues reliably via
// NotificationDispatchJob). sms/whatsapp/in_app/social on a campaign are
// still real CRUD, just not yet dispatched by this action.
const DISPATCHABLE_CHANNELS = new Set(['email', 'push']);

// PATCH /api/lifecycle-campaigns/:id — status transitions (Launch/Pause buttons).
// Launch (-> RUNNING) now does real work, not just a status flip: if the
// campaign has a real notification_template_slug linked, it enqueues one
// real notification_queue row per consented customer per dispatchable
// channel -- the existing NotificationDispatchJob consent/quiet-hour/
// frequency gates then apply exactly as they do to every other queued
// notification. Guarded by dispatched_at so a pause/resume cycle never
// re-messages the same audience twice.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { status?: string } | null;
  if (!body?.status || !ALLOWED_STATUSES.has(body.status)) {
    return Response.json({ error: 'A valid status is required.' }, { status: 400 });
  }

  const current = await query<{
    tenant_id: string; status: string; channels: string[]; notification_template_slug: string | null; dispatched_at: string | null; name: string;
  }>(`SELECT tenant_id, status, channels, notification_template_slug, dispatched_at, name FROM lifecycle_campaign WHERE id = $1`, [params.id]);
  if (!current.rowCount) return Response.json({ error: 'Campaign not found.' }, { status: 404 });
  const campaign = current.rows[0];

  let dispatch: { queued: number; note: string } | null = null;
  const isFirstLaunch = body.status === 'RUNNING' && campaign.status !== 'RUNNING' && !campaign.dispatched_at;

  if (isFirstLaunch) {
    if (!campaign.notification_template_slug) {
      dispatch = { queued: 0, note: 'No notification template linked -- status updated, nothing queued.' };
    } else {
      const channels = campaign.channels.filter(c => DISPATCHABLE_CHANNELS.has(c));
      if (!channels.length) {
        dispatch = { queued: 0, note: 'No dispatchable channel (email/push) on this campaign -- status updated, nothing queued.' };
      } else {
        let queued = 0;
        await transaction(async client => {
          for (const channel of channels) {
            const template = await client.query<{ slug: string }>(
              `SELECT slug FROM notification_template WHERE tenant_id=$1 AND slug=$2 AND channel=$3 AND status IN ('active','approved') LIMIT 1`,
              [campaign.tenant_id, campaign.notification_template_slug, channel],
            );
            if (!template.rowCount) continue;
            const recipients = await client.query<{ user_id: string; email: string }>(
              `SELECT c.user_id, c.email FROM customer c
               JOIN notification_preference np ON np.user_id = c.user_id AND np.tenant_id = c.tenant_id
               WHERE c.tenant_id = $1 AND np.marketing_enabled = TRUE
                 AND ($2 != 'email' OR c.email_opt_in = TRUE)`,
              [campaign.tenant_id, channel],
            );
            // Deterministic idempotency_key + ON CONFLICT DO NOTHING -- the
            // same real pattern AppointmentReminderJob.ts already uses, and
            // atomically race-safe (an earlier check-then-insert here threw
            // a real NOT NULL violation on idempotency_key, caught live
            // during verification: the column has no default).
            for (const r of recipients.rows) {
              const result = await client.query(
                `INSERT INTO notification_queue (tenant_id, recipient_user_id, recipient_address, channel, type, template_slug, payload, status, idempotency_key)
                 VALUES ($1,$2,$3,$4,'marketing',$5,$6,'pending',$7)
                 ON CONFLICT (tenant_id, idempotency_key) DO NOTHING`,
                [campaign.tenant_id, r.user_id, channel === 'email' ? r.email : r.user_id, channel,
                  campaign.notification_template_slug, JSON.stringify({ campaignId: params.id, campaignName: campaign.name, url: '/' }),
                  `lifecycle-campaign-${params.id}-${channel}-${r.user_id}`],
              );
              if ((result.rowCount ?? 0) > 0) queued++;
            }
          }
          await client.query(
            `UPDATE lifecycle_campaign SET status=$1, dispatched_at=now(), audience_size=$2, updated_at=now() WHERE id=$3`,
            [body.status, queued, params.id],
          );
        });
        dispatch = { queued, note: queued > 0 ? `Queued ${queued} real message(s) for dispatch.` : 'Template linked, but zero customers currently have marketing consent for these channels -- nothing queued.' };
      }
    }
  }

  if (!dispatch) {
    const result = await query(
      `UPDATE lifecycle_campaign SET status = $1, updated_at = now() WHERE id = $2 RETURNING id`,
      [body.status, params.id],
    );
    if (!result.rows.length) return Response.json({ error: 'Campaign not found.' }, { status: 404 });
  }

  return Response.json({ ok: true, dispatch });
}
