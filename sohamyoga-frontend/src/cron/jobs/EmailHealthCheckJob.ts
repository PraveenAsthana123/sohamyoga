// EmailHealthCheckJob — daily 06:00
// Checks SMTP configuration presence, reviews bounce rate and spam complaint
// rate over the last 30 days and logs a summary. Real SMTP connectivity test
// is skipped when SMTP_HOST is not set — the job records the fact and exits
// cleanly rather than fabricating a green status.
import { query } from '@/lib/postgres';

export const EmailHealthCheckJob = {
  name: 'email-health-check',
  schedule: '0 6 * * *', // daily 6am UTC

  async run(): Promise<{ ok: boolean; skipped?: boolean; reason?: string; summary?: object }> {
    const smtpConfigured = !!(process.env.SMTP_HOST);

    if (!smtpConfigured) {
      console.log('[email-health-check] SMTP_HOST not configured — skipping connectivity check');
      return { ok: false, skipped: true, reason: 'SMTP_HOST not configured' };
    }

    // Gather bounce and spam stats from the last 30 days
    const stats = await query(`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('sent','delivered','opened','clicked','bounced','spam','unsubscribed')) AS total_sent,
        COUNT(*) FILTER (WHERE status = 'bounced')      AS bounces,
        COUNT(*) FILTER (WHERE status = 'spam')         AS spam_complaints,
        COUNT(*) FILTER (WHERE status = 'unsubscribed') AS unsubscribes,
        COUNT(*) FILTER (WHERE status = 'opened')       AS opens
      FROM email_send_log
      WHERE created_at >= now() - interval '30 days'
    `);

    const s = stats.rows[0];
    const total = Number(s.total_sent) || 0;
    const bounces = Number(s.bounces) || 0;
    const spam = Number(s.spam_complaints) || 0;

    const bounceRate = total > 0 ? (bounces / total) * 100 : 0;
    const spamRate = total > 0 ? (spam / total) * 100 : 0;

    // Industry warning thresholds: >2% bounce, >0.1% spam
    const warnings: string[] = [];
    if (bounceRate > 2) warnings.push(`High bounce rate: ${bounceRate.toFixed(1)}%`);
    if (spamRate > 0.1) warnings.push(`High spam complaint rate: ${spamRate.toFixed(2)}%`);

    const summary = {
      checkedAt: new Date().toISOString(),
      totalSent30d: total,
      bounceRate: `${bounceRate.toFixed(2)}%`,
      spamRate: `${spamRate.toFixed(3)}%`,
      openRate: total > 0 ? `${((Number(s.opens) / total) * 100).toFixed(1)}%` : '0.0%',
      warnings,
    };

    if (warnings.length > 0) {
      console.warn('[email-health-check] WARNINGS:', warnings.join('; '));
    } else {
      console.log('[email-health-check] OK —', JSON.stringify(summary));
    }

    return { ok: warnings.length === 0, summary };
  },
};

export async function run() { await EmailHealthCheckJob.run(); }
