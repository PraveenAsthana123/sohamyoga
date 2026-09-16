export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

async function ensureSchema() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS omnichannel_touchpoints (
        id SERIAL PRIMARY KEY,
        channel TEXT,
        customer_id TEXT,
        event_type TEXT,
        content_preview TEXT,
        response_time_minutes NUMERIC DEFAULT 0,
        resolved BOOLEAN DEFAULT FALSE,
        sentiment TEXT DEFAULT 'neutral',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS omnichannel_journeys (
        id SERIAL PRIMARY KEY,
        customer_id TEXT,
        stage TEXT DEFAULT 'awareness',
        channels_used TEXT[],
        touchpoints_count INTEGER DEFAULT 0,
        last_interaction TIMESTAMPTZ DEFAULT NOW(),
        nps_score INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const { rows: tpRows } = await client.query(`SELECT COUNT(*)::int AS cnt FROM omnichannel_touchpoints`);
    if (tpRows[0].cnt === 0) {
      await client.query(`
        INSERT INTO omnichannel_touchpoints (channel, customer_id, event_type, content_preview, response_time_minutes, resolved, sentiment) VALUES
        ('email', 'cust_001', 'inquiry', 'Asking about class schedule for next month', 12, true, 'neutral'),
        ('whatsapp', 'cust_002', 'complaint', 'Class was cancelled without notice!', 5, true, 'negative'),
        ('sms', 'cust_003', 'booking', 'Confirmed morning yoga slot for Thursday', 2, true, 'positive'),
        ('social', 'cust_004', 'mention', 'Loved the Saturday session! @SohamYoga', 45, false, 'positive'),
        ('voice', 'cust_005', 'support', 'Billing issue with membership renewal', 8, true, 'neutral'),
        ('email', 'cust_006', 'marketing', 'Welcome email opened — clicked CTA', 0, true, 'positive'),
        ('whatsapp', 'cust_007', 'inquiry', 'Do you offer kids yoga classes?', 3, true, 'neutral'),
        ('sms', 'cust_008', 'reminder', 'Class reminder sent — confirmed attendance', 0, true, 'positive'),
        ('social', 'cust_009', 'comment', 'When is the next retreat? Please share details!', 120, false, 'positive'),
        ('voice', 'cust_010', 'complaint', 'Instructor was 15 minutes late today', 4, true, 'negative'),
        ('email', 'cust_011', 'inquiry', 'Corporate wellness package pricing request', 25, false, 'neutral'),
        ('whatsapp', 'cust_012', 'booking', 'Booked private session for Friday 6pm', 1, true, 'positive'),
        ('sms', 'cust_013', 'alert', 'Payment failed — please update card', 0, false, 'neutral'),
        ('email', 'cust_014', 'support', 'Cannot access online class recordings', 18, true, 'neutral'),
        ('social', 'cust_015', 'review', 'Five stars — best yoga studio in the city!', 30, true, 'positive'),
        ('voice', 'cust_016', 'inquiry', 'Asking about instructor certifications', 6, true, 'neutral'),
        ('whatsapp', 'cust_017', 'complaint', 'App keeps crashing during live stream', 9, true, 'negative'),
        ('email', 'cust_018', 'booking', 'Trial class registration form submitted', 5, true, 'positive'),
        ('sms', 'cust_019', 'marketing', 'Flash sale SMS — 30% off annual plan', 0, true, 'positive'),
        ('social', 'cust_020', 'inquiry', 'Is there parking near the studio?', 60, true, 'neutral')
      `);
    }

    const { rows: jRows } = await client.query(`SELECT COUNT(*)::int AS cnt FROM omnichannel_journeys`);
    if (jRows[0].cnt === 0) {
      await client.query(`
        INSERT INTO omnichannel_journeys (customer_id, stage, channels_used, touchpoints_count, nps_score) VALUES
        ('cust_001', 'consideration', ARRAY['email','whatsapp'], 3, NULL),
        ('cust_002', 'retention', ARRAY['whatsapp','voice'], 5, 7),
        ('cust_003', 'loyalty', ARRAY['sms','email','voice'], 8, 9),
        ('cust_004', 'advocacy', ARRAY['social','email'], 4, 10),
        ('cust_005', 'awareness', ARRAY['voice'], 1, NULL),
        ('cust_006', 'consideration', ARRAY['email'], 2, NULL),
        ('cust_007', 'acquisition', ARRAY['whatsapp','email'], 3, 8),
        ('cust_008', 'loyalty', ARRAY['sms','whatsapp','email','social'], 12, 9)
      `);
    }
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSchema();

  const pool = getPool();
  const client = await pool.connect();
  try {
    const [tpRes, resolvedRes, responseRes, npsRes] = await Promise.all([
      client.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE created_at >= NOW()-INTERVAL '24 hours')::int AS today FROM omnichannel_touchpoints`),
      client.query(`SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE resolved) / NULLIF(COUNT(*),0), 1)::numeric AS resolution_rate FROM omnichannel_touchpoints`),
      client.query(`SELECT ROUND(AVG(response_time_minutes)::numeric, 1) AS avg_response FROM omnichannel_touchpoints WHERE response_time_minutes > 0`),
      client.query(`SELECT ROUND(AVG(nps_score)::numeric, 1) AS avg_nps FROM omnichannel_journeys WHERE nps_score IS NOT NULL`),
    ]);

    const totalTp = tpRes.rows[0]?.total ?? 0;
    const todayTp = tpRes.rows[0]?.today ?? 0;
    const resolutionRate = Number(resolvedRes.rows[0]?.resolution_rate ?? 0);
    const avgResponse = Number(responseRes.rows[0]?.avg_response ?? 0);
    const avgNps = Number(npsRes.rows[0]?.avg_nps ?? 0);

    const responseScore = avgResponse <= 15 ? 34 : avgResponse <= 30 ? 20 : 0;
    const resolutionScore = resolutionRate >= 80 ? 33 : resolutionRate >= 60 ? 20 : 0;
    const npsScore = avgNps >= 8 ? 33 : avgNps >= 6 ? 20 : 0;
    const health_score = Math.min(100, responseScore + resolutionScore + npsScore);

    return Response.json({
      health_score,
      traffic_light: health_score >= 70 ? 'green' : health_score >= 40 ? 'yellow' : 'red',
      kpis: [
        { label: 'Touchpoints Today', value: todayTp, target: 10, trend: todayTp >= 5 ? 'up' : 'down', unit: 'events' },
        { label: 'Total Touchpoints', value: totalTp, target: 50, trend: totalTp >= 30 ? 'up' : 'down', unit: 'total' },
        { label: 'Avg Response Time', value: avgResponse, target: 15, trend: avgResponse <= 15 ? 'up' : 'down', unit: 'min' },
        { label: 'Resolution Rate', value: `${resolutionRate}`, target: 80, trend: resolutionRate >= 80 ? 'up' : 'down', unit: '%' },
        { label: 'Avg NPS', value: avgNps.toFixed(1), target: 8, trend: avgNps >= 8 ? 'up' : 'down', unit: '/10' },
      ],
      updated_at: new Date().toISOString(),
    });
  } finally {
    client.release();
  }
}
