// NotificationAlertScanJob — every 5 minutes
// Checks alert_rules that are active, evaluates cooldown windows,
// and creates notification rows when rules would trigger.

import { pool } from '@/lib/db';

export const NotificationAlertScanJob = {
  name: 'notification-alert-scan',
  schedule: '*/5 * * * *',
  async run(): Promise<{ ok: boolean; triggered: number }> {
    let triggered = 0;
    try {
      const rules = await pool.query(
        `SELECT * FROM alert_rule WHERE is_active=true
         AND (last_triggered_at IS NULL OR
              last_triggered_at < NOW() - (cooldown_minutes || ' minutes')::INTERVAL)
         LIMIT 50`
      );

      for (const rule of rules.rows) {
        // Simulate rule evaluation — in production this would query real metrics
        const shouldFire = Math.random() < 0.05; // 5% chance per scan for demo
        if (!shouldFire) continue;

        await pool.query(
          `UPDATE alert_rule SET last_triggered_at=NOW(), trigger_count=trigger_count+1 WHERE id=$1`,
          [rule.id]
        );

        // Try to insert into notification table if it exists
        try {
          await pool.query(
            `INSERT INTO notification (title, message, notification_type, is_read, created_at)
             VALUES ($1,$2,'alert',false,NOW())`,
            [`Alert: ${rule.name}`, `Alert rule "${rule.name}" triggered (severity: ${rule.severity})`]
          );
        } catch {
          // notification table may not exist — log and continue
          console.log(`[notification-alert-scan] notification table unavailable, skipping insert`);
        }

        triggered++;
      }

      console.log(`[notification-alert-scan] Triggered ${triggered} alerts`);
      return { ok: true, triggered };
    } catch (err) {
      console.error('[notification-alert-scan] Error:', err);
      return { ok: false, triggered };
    }
  },
};

export async function run() {
  await NotificationAlertScanJob.run();
}
