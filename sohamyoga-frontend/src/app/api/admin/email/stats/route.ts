import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const [subsResult, campaignsResult, sendLogResult] = await Promise.all([
    query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active')        AS active,
        COUNT(*) FILTER (WHERE status = 'unsubscribed')  AS unsubscribed,
        COUNT(*) FILTER (WHERE status = 'bounced')       AS bounced,
        COUNT(*)                                          AS total
      FROM email_subscriber
    `),
    query(`
      SELECT COUNT(*) AS total,
             COUNT(*) FILTER (WHERE status = 'sent') AS sent
      FROM email_campaign
      WHERE created_at >= now() - interval '30 days'
    `),
    query(`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('sent','delivered','opened','clicked')) AS delivered,
        COUNT(*) FILTER (WHERE status = 'opened')     AS opens,
        COUNT(*) FILTER (WHERE status = 'clicked')    AS clicks,
        COUNT(*) FILTER (WHERE status = 'bounced')    AS bounces,
        COUNT(*) FILTER (WHERE status = 'unsubscribed') AS unsubscribes,
        COUNT(*) FILTER (WHERE status = 'spam')       AS spam,
        COUNT(*)                                       AS total_sent
      FROM email_send_log
      WHERE created_at >= now() - interval '30 days'
    `),
  ]);

  const s = subsResult.rows[0];
  const c = campaignsResult.rows[0];
  const l = sendLogResult.rows[0];

  const totalSent = Number(l.total_sent) || 0;
  const opens = Number(l.opens) || 0;
  const clicks = Number(l.clicks) || 0;
  const bounces = Number(l.bounces) || 0;
  const unsubscribes = Number(l.unsubscribes) || 0;

  const smtpConfigured = !!(process.env.SMTP_HOST);

  return Response.json({
    smtpConfigured,
    subscribers: {
      total: Number(s.total) || 0,
      active: Number(s.active) || 0,
      unsubscribed: Number(s.unsubscribed) || 0,
      bounced: Number(s.bounced) || 0,
    },
    campaigns30d: {
      total: Number(c.total) || 0,
      sent: Number(c.sent) || 0,
    },
    metrics30d: {
      totalSent,
      delivered: Number(l.delivered) || 0,
      opens,
      clicks,
      bounces,
      unsubscribes,
      spam: Number(l.spam) || 0,
      openRate: totalSent > 0 ? ((opens / totalSent) * 100).toFixed(1) : '0.0',
      clickRate: totalSent > 0 ? ((clicks / totalSent) * 100).toFixed(1) : '0.0',
      bounceRate: totalSent > 0 ? ((bounces / totalSent) * 100).toFixed(1) : '0.0',
      unsubRate: totalSent > 0 ? ((unsubscribes / totalSent) * 100).toFixed(1) : '0.0',
    },
  });
}
