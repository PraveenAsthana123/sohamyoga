import { NextRequest} from 'next/server';
import { pool } from '@/lib/db';

import { requireAdmin } from '@/lib/admin-auth';
export async function POST(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS broadcast (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200),
        subject VARCHAR(300),
        body TEXT,
        broadcast_type VARCHAR(20),
        target_audience VARCHAR(30),
        status VARCHAR(20) DEFAULT 'draft',
        scheduled_at TIMESTAMPTZ,
        sent_at TIMESTAMPTZ,
        recipient_count INT DEFAULT 0,
        delivered_count INT DEFAULT 0,
        opened_count INT DEFAULT 0,
        clicked_count INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS alert_rule (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200),
        category VARCHAR(50),
        condition_config JSONB DEFAULT '{}',
        channels TEXT,
        severity VARCHAR(20) DEFAULT 'medium',
        is_active BOOLEAN DEFAULT true,
        cooldown_minutes INT DEFAULT 60,
        last_triggered_at TIMESTAMPTZ,
        trigger_count INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Seed alert rules
    const rules = [
      { name: 'Platform Health Critical', category: 'platform_health', severity: 'critical', channels: 'email,slack', cond: { metric: 'health_score', threshold: 50 } },
      { name: 'Rate Limit 90%', category: 'rate_limit', severity: 'high', channels: 'email,slack', cond: { metric: 'api_usage_pct', threshold: 90 } },
      { name: 'Workflow Failure', category: 'workflow', severity: 'high', channels: 'email', cond: { metric: 'workflow_failure_count', threshold: 3 } },
      { name: 'New Lead Captured', category: 'leads', severity: 'low', channels: 'slack', cond: { event: 'new_lead' } },
      { name: 'Negative Review Alert', category: 'reviews', severity: 'medium', channels: 'email,slack', cond: { metric: 'review_rating', threshold: 2 } },
      { name: 'Token Expiring Soon', category: 'security', severity: 'high', channels: 'email', cond: { metric: 'token_expiry_days', threshold: 7 } },
      { name: 'New Affiliate Signup', category: 'affiliates', severity: 'low', channels: 'slack', cond: { event: 'new_affiliate' } },
      { name: 'Failed Payment', category: 'billing', severity: 'high', channels: 'email,slack', cond: { event: 'payment_failed' } },
    ];

    for (const r of rules) {
      await pool.query(
        `INSERT INTO alert_rule (name, category, condition_config, channels, severity)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
        [r.name, r.category, JSON.stringify(r.cond), r.channels, r.severity]
      );
    }

    // Seed broadcast history
    const broadcasts = [
      { name: 'Welcome Series Q3', subject: 'Welcome to SohamYoga Platform!', broadcast_type: 'email', target_audience: 'all_customers', status: 'sent', recipient_count: 1240, delivered_count: 1203, opened_count: 264, clicked_count: 88 },
      { name: 'September Promotion', subject: '🧘 20% off Annual Plans this September', broadcast_type: 'email', target_audience: 'leads', status: 'sent', recipient_count: 856, delivered_count: 830, opened_count: 174, clicked_count: 52 },
      { name: 'Platform Maintenance Notice', subject: 'Scheduled Maintenance - Sep 20', broadcast_type: 'all', target_audience: 'all_customers', status: 'sent', recipient_count: 1240, delivered_count: 1204, opened_count: 320, clicked_count: 45 },
      { name: 'Weekly Newsletter', subject: 'Your Weekly Digital Marketing Digest', broadcast_type: 'email', target_audience: 'subscribers', status: 'scheduled', recipient_count: 0, delivered_count: 0, opened_count: 0, clicked_count: 0 },
      { name: 'Black Friday Teaser', subject: 'Something BIG is coming... 🔥', broadcast_type: 'email', target_audience: 'all_customers', status: 'draft', recipient_count: 0, delivered_count: 0, opened_count: 0, clicked_count: 0 },
    ];

    for (const b of broadcasts) {
      await pool.query(
        `INSERT INTO broadcast (name, subject, body, broadcast_type, target_audience, status,
          recipient_count, delivered_count, opened_count, clicked_count, sent_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [b.name, b.subject, 'Seeded broadcast body content.', b.broadcast_type, b.target_audience,
         b.status, b.recipient_count, b.delivered_count, b.opened_count, b.clicked_count,
         b.status === 'sent' ? new Date() : null]
      );
    }

    return Response.json({ ok: true, message: 'Tables created, 8 alert rules + 5 broadcasts seeded' });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
