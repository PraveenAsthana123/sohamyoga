// DunningManagementJob — Daily
// Real dunning: subscription_master.status='grace_period' + grace_period_ends_at
// already exist (the Subscription FSM), but nothing ever notified anyone
// during that window -- a subscriber could silently expire with zero
// reminder. Sends exactly one real notification per remaining-days bucket
// (3d/1d/final day) via notification_queue, idempotent per subscription
// per bucket so it never re-sends the same reminder twice.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const REMINDER_BUCKETS = [3, 1, 0] as const; // days remaining

function bucketFor(daysRemaining: number): number | null {
  if (daysRemaining <= 0) return 0;
  if (daysRemaining <= 1) return 1;
  if (daysRemaining <= 3) return 3;
  return null;
}

export async function run(): Promise<void> {
  const tenant = await db.query<{ id: string }>(`SELECT id FROM tenant LIMIT 1`);
  if (!tenant.rowCount) { console.log('[dunning-management] no tenant configured, skipping'); return; }
  const tenantId = tenant.rows[0].id;

  const graceSubs = await db.query<{ id: string; customer_id: string; grace_period_ends_at: string; email: string | null }>(
    `SELECT sm.id, c.id AS customer_id, sm.grace_period_ends_at, c.email
     FROM subscription_master sm
     JOIN customer c ON c.id::text = sm.customer_id
     WHERE sm.status = 'grace_period' AND sm.grace_period_ends_at IS NOT NULL`,
  );

  let sent = 0;
  for (const sub of graceSubs.rows) {
    const daysRemaining = (new Date(sub.grace_period_ends_at).getTime() - Date.now()) / 86_400_000;
    const bucket = bucketFor(daysRemaining);
    if (bucket === null || !sub.email) continue;

    const idempotencyKey = `dunning_${sub.id}_bucket_${bucket}`;
    const result = await db.query(
      `INSERT INTO notification_queue
         (tenant_id, template_slug, channel, type, recipient_user_id, recipient_address, payload, idempotency_key)
       VALUES ($1,'dunning_reminder','email','alert',$2,$3,$4,$5)
       ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
       RETURNING id`,
      [tenantId, sub.customer_id, sub.email, JSON.stringify({ subscriptionId: sub.id, daysRemaining: Math.max(0, Math.round(daysRemaining)), graceEndsAt: sub.grace_period_ends_at }), idempotencyKey],
    );
    if (result.rowCount) sent++;
  }

  console.log(`[dunning-management] graceSubs=${graceSubs.rows.length} remindersSent=${sent}`);
  // Do NOT db.end() here — see NotificationRetryJob.ts.
}
