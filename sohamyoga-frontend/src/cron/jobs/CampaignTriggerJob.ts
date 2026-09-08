// CampaignTriggerJob — Every 15 minutes
// Real Trigger Management execution: lifecycle_campaign.campaign_type
// already had a real 'trigger' value but nothing ever bound it to an
// actual event or fired it -- it was a selectable label with zero
// behavior. This job checks each active trigger campaign's real
// trigger_event against new journey_touchpoint rows of that type,
// resolves the touchpoint's contact_identifier (email) to a real
// customer/student, and queues one real notification per new match --
// idempotent via lifecycle_campaign_trigger_log's unique constraint.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

export async function run(): Promise<void> {
  const campaigns = await db.query<{ id: string; tenant_id: string; name: string; trigger_event: string; channels: string[] }>(
    `SELECT id, tenant_id, name, trigger_event, channels FROM lifecycle_campaign
     WHERE campaign_type = 'trigger' AND status = 'RUNNING' AND trigger_event IS NOT NULL`,
  );

  let fired = 0;
  for (const campaign of campaigns.rows) {
    const touchpoints = await db.query<{ id: string; contact_identifier: string; occurred_at: string }>(
      `SELECT jt.id, jt.contact_identifier, jt.occurred_at
       FROM journey_touchpoint jt
       WHERE jt.tenant_id = $1 AND jt.touchpoint_type = $2
         AND NOT EXISTS (SELECT 1 FROM lifecycle_campaign_trigger_log l WHERE l.campaign_id = $3 AND l.touchpoint_id = jt.id)
       ORDER BY jt.occurred_at ASC LIMIT 100`,
      [campaign.tenant_id, campaign.trigger_event, campaign.id],
    );

    for (const tp of touchpoints.rows) {
      const recipient = await db.query<{ id: string; email: string }>(
        `SELECT id, email FROM customer WHERE tenant_id = $1 AND email = $2
         UNION SELECT id, email FROM student WHERE tenant_id = $1 AND email = $2 LIMIT 1`,
        [campaign.tenant_id, tp.contact_identifier],
      );

      // Log the touchpoint as processed regardless of match, so a
      // permanently-unmatched contact isn't re-checked every 15 minutes
      // forever.
      await db.query(
        `INSERT INTO lifecycle_campaign_trigger_log (campaign_id, touchpoint_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [campaign.id, tp.id],
      );
      if (!recipient.rowCount) continue;

      const channel = campaign.channels[0] ?? 'email';
      await db.query(
        `INSERT INTO notification_queue
           (tenant_id, template_slug, channel, type, recipient_user_id, recipient_address, payload, idempotency_key)
         VALUES ($1,'lifecycle_trigger',$2,'marketing',$3,$4,$5,$6)
         ON CONFLICT (tenant_id, idempotency_key) DO NOTHING`,
        [
          campaign.tenant_id, channel, recipient.rows[0].id, recipient.rows[0].email,
          JSON.stringify({ campaignId: campaign.id, campaignName: campaign.name, touchpointId: tp.id }),
          `lifecycle_trigger_${campaign.id}_${tp.id}`,
        ],
      );
      fired++;
    }

    if (touchpoints.rows.length) {
      await db.query(`UPDATE lifecycle_campaign SET last_triggered_at = now(), updated_at = now() WHERE id = $1`, [campaign.id]);
    }
  }

  console.log(`[campaign-trigger] campaigns=${campaigns.rows.length} notificationsFired=${fired}`);
  // Do NOT db.end() here — see NotificationRetryJob.ts.
}
