export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export async function GET(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS pii_scans (
        id SERIAL PRIMARY KEY,
        content_snippet TEXT,
        content_type TEXT DEFAULT 'ai_output',
        pii_found BOOLEAN DEFAULT FALSE,
        pii_types TEXT[],
        risk_level TEXT DEFAULT 'low',
        masked_content TEXT,
        scanned_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS pii_policies (
        id SERIAL PRIMARY KEY,
        name TEXT,
        pii_type TEXT,
        action TEXT DEFAULT 'mask',
        enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Seed policies
    const { rows: polCount } = await client.query('SELECT COUNT(*)::int AS c FROM pii_policies');
    if (polCount[0].c === 0) {
      await client.query(`INSERT INTO pii_policies (name, pii_type, action) VALUES
        ('Email Masking', 'email', 'mask'),
        ('Phone Number Masking', 'phone', 'mask'),
        ('SSN Redaction', 'ssn', 'redact'),
        ('Credit Card Masking', 'credit_card', 'mask'),
        ('Address Redaction', 'address', 'redact')`);
    }

    // Seed scans
    const { rows: scanCount } = await client.query('SELECT COUNT(*)::int AS c FROM pii_scans');
    if (scanCount[0].c === 0) {
      await client.query(`INSERT INTO pii_scans (content_snippet, content_type, pii_found, pii_types, risk_level, masked_content, scanned_at) VALUES
        ('Contact me at john@example.com for more info', 'ai_output', true, ARRAY['email'], 'medium', 'Contact me at [REDACTED_EMAIL] for more info', NOW() - INTERVAL '1 hour'),
        ('Call me at 416-555-0123 anytime', 'user_input', true, ARRAY['phone'], 'medium', 'Call me at [REDACTED_PHONE] anytime', NOW() - INTERVAL '2 hours'),
        ('My SSN is 123-45-6789', 'user_input', true, ARRAY['ssn'], 'high', 'My SSN is [REDACTED_SSN]', NOW() - INTERVAL '3 hours'),
        ('Yoga classes are great for wellness', 'ai_output', false, ARRAY[]::text[], 'low', 'Yoga classes are great for wellness', NOW() - INTERVAL '4 hours'),
        ('Payment card: 4111-1111-1111-1111', 'user_input', true, ARRAY['credit_card'], 'high', 'Payment card: [REDACTED_CREDIT_CARD]', NOW() - INTERVAL '5 hours'),
        ('Send to 123 Main St, Toronto ON', 'ai_output', true, ARRAY['address'], 'medium', 'Send to [REDACTED_ADDRESS]', NOW() - INTERVAL '6 hours'),
        ('Book your next class today!', 'ai_output', false, ARRAY[]::text[], 'low', 'Book your next class today!', NOW() - INTERVAL '7 hours'),
        ('Email sarah.jones@gmail.com, phone 647-999-8888', 'user_input', true, ARRAY['email','phone'], 'high', 'Email [REDACTED_EMAIL], phone [REDACTED_PHONE]', NOW() - INTERVAL '8 hours'),
        ('The instructor was amazing', 'user_input', false, ARRAY[]::text[], 'low', 'The instructor was amazing', NOW() - INTERVAL '9 hours'),
        ('SIN: 456 789 012', 'user_input', true, ARRAY['ssn'], 'high', 'SIN: [REDACTED_SSN]', NOW() - INTERVAL '10 hours')`);
    }

    const [statsRes, policiesRes] = await Promise.all([
      client.query(`
        SELECT
          COUNT(*)::int AS total_scans,
          COUNT(*) FILTER (WHERE pii_found = TRUE)::int AS pii_found_count,
          COUNT(*) FILTER (WHERE risk_level = 'high')::int AS high_risk,
          COUNT(*) FILTER (WHERE scanned_at >= NOW() - INTERVAL '24 hours')::int AS scans_today
        FROM pii_scans
      `).catch(() => ({ rows: [{ total_scans: 0, pii_found_count: 0, high_risk: 0, scans_today: 0 }] })),
      client.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE enabled)::int AS active FROM pii_policies`).catch(() => ({ rows: [{ total: 0, active: 0 }] })),
    ]);

    const st = statsRes.rows[0];
    const totalScans = parseInt(st.total_scans) || 1;
    const piiDetected = parseInt(st.pii_found_count) || 0;
    const detectionRate = Math.round((piiDetected / totalScans) * 100);
    const policyCoverage = Math.round((policiesRes.rows[0].active / Math.max(1, policiesRes.rows[0].total)) * 100);

    const health_score = Math.min(100,
      (policyCoverage >= 100 ? 40 : policyCoverage >= 80 ? 25 : 10) +
      (st.high_risk === 0 ? 40 : st.high_risk <= 2 ? 20 : 5) +
      20
    );

    return Response.json({
      health_score,
      traffic_light: health_score >= 70 ? 'green' : health_score >= 40 ? 'yellow' : 'red',
      detection_rate: detectionRate,
      policy_coverage: policyCoverage,
      high_risk_count: st.high_risk,
      total_scans: totalScans,
      kpis: [
        { label: 'PII Detection Rate', value: detectionRate, target: 100, trend: detectionRate >= 80 ? 'up' : 'down', unit: '%' },
        { label: 'Policy Coverage', value: policyCoverage, target: 100, trend: policyCoverage >= 100 ? 'up' : 'down', unit: '%' },
        { label: 'High-Risk Scans', value: st.high_risk, target: 0, trend: st.high_risk === 0 ? 'up' : 'down', unit: 'scans' },
        { label: 'Scans Today', value: st.scans_today, target: 10, trend: st.scans_today >= 10 ? 'up' : 'down', unit: 'scans' },
      ],
      updated_at: new Date().toISOString(),
    });
  } finally {
    client.release();
  }
}
