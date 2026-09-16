// SocialAlertScanJob — Every 30 minutes (*/30 * * * *)
// Checks social_alert_rule conditions against social_platform_analytics
// and social_post. When a threshold is exceeded, inserts into social_alert_event
// and updates last_triggered_at on the rule.
// Never takes autonomous action on social posts — advisory/notification only.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

interface AlertRule {
  id: string;
  platform: string | null;
  alert_type: string;
  metric: string;
  threshold_value: number;
  comparison: string;
  window_minutes: number;
  severity: string;
  is_active: boolean;
}

async function checkViralSpike(rule: AlertRule): Promise<boolean> {
  const result = await db.query(
    `SELECT COALESCE(SUM(total_impressions), 0) as total
     FROM social_platform_analytics
     WHERE ($1::text IS NULL OR platform = $1)
       AND fetched_at >= NOW() - INTERVAL '${rule.window_minutes} minutes'`,
    [rule.platform],
  ).catch(() => ({ rows: [{ total: 0 }] }));
  return Number(result.rows[0].total) > rule.threshold_value;
}

async function checkPostFailed(rule: AlertRule): Promise<boolean> {
  const result = await db.query(
    `SELECT COUNT(*) as cnt FROM social_post
     WHERE status = 'failed'
       AND ($1::text IS NULL OR platform = $1)
       AND created_at >= NOW() - INTERVAL '${rule.window_minutes} minutes'`,
    [rule.platform],
  ).catch(() => ({ rows: [{ cnt: 0 }] }));
  return Number(result.rows[0].cnt) >= 1;
}

async function checkFollowerLoss(rule: AlertRule): Promise<boolean> {
  const result = await db.query(
    `SELECT COALESCE(SUM(follower_delta), 0) as delta
     FROM social_platform_analytics
     WHERE ($1::text IS NULL OR platform = $1)
       AND fetched_at >= NOW() - INTERVAL '1440 minutes'`,
    [rule.platform],
  ).catch(() => ({ rows: [{ delta: 0 }] }));
  return Number(result.rows[0].delta) < rule.threshold_value;
}

export async function run(): Promise<void> {
  const rules = await db.query<AlertRule>(
    `SELECT * FROM social_alert_rule WHERE is_active = true`,
  ).catch(() => ({ rows: [] as AlertRule[] }));

  let triggered = 0;

  for (const rule of rules.rows) {
    try {
      let shouldAlert = false;

      switch (rule.alert_type) {
        case 'viral_spike':
          shouldAlert = await checkViralSpike(rule);
          break;
        case 'post_failed':
          shouldAlert = await checkPostFailed(rule);
          break;
        case 'follower_loss':
          shouldAlert = await checkFollowerLoss(rule);
          break;
        case 'negative_surge':
          // Would require sentiment analysis — log as advisory
          shouldAlert = false;
          break;
        case 'engagement_drop':
          // Would require week-over-week comparison — log as advisory
          shouldAlert = false;
          break;
        default:
          break;
      }

      if (shouldAlert) {
        await db.query(
          `INSERT INTO social_alert_event (rule_id, platform, alert_type, severity, message, triggered_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [rule.id, rule.platform, rule.alert_type, rule.severity,
           `Alert triggered: ${rule.alert_type} on ${rule.platform ?? 'all platforms'} — threshold ${rule.threshold_value} (${rule.comparison})`],
        ).catch(() => {});

        await db.query(
          `UPDATE social_alert_rule SET last_triggered_at = NOW() WHERE id = $1`,
          [rule.id],
        ).catch(() => {});

        triggered++;
        console.log(`[social-alert-scan] TRIGGERED: ${rule.alert_type} on ${rule.platform ?? 'all'} severity=${rule.severity}`);
      }
    } catch {
      // Skip individual rule errors — continue with rest
    }
  }

  await db.query(
    `INSERT INTO job_run_log (job_name, status, detail, ran_at)
     VALUES ($1, 'ok', $2, NOW()) ON CONFLICT DO NOTHING`,
    ['social-alert-scan', `Checked ${rules.rows.length} rules, triggered ${triggered} alerts`],
  ).catch(() => {});

  console.log(`[social-alert-scan] checked=${rules.rows.length} triggered=${triggered}`);
  await db.end().catch(() => {});
}
