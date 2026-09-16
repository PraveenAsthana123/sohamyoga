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
      CREATE TABLE IF NOT EXISTS voice_ai_calls (
        id SERIAL PRIMARY KEY,
        agent_name TEXT,
        caller_number TEXT,
        direction TEXT DEFAULT 'inbound',
        duration_seconds INTEGER DEFAULT 0,
        outcome TEXT DEFAULT 'completed',
        sentiment TEXT DEFAULT 'neutral',
        transcript_snippet TEXT,
        cost_usd NUMERIC DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS voice_ai_agents (
        id SERIAL PRIMARY KEY,
        name TEXT,
        voice_id TEXT,
        persona TEXT,
        script TEXT,
        status TEXT DEFAULT 'active',
        calls_handled INTEGER DEFAULT 0,
        avg_csat NUMERIC DEFAULT 4.0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS voice_ai_scripts (
        id SERIAL PRIMARY KEY,
        agent_id INTEGER,
        script_name TEXT,
        intent TEXT,
        utterances JSONB,
        response TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const { rows: agentRows } = await client.query(`SELECT COUNT(*)::int AS cnt FROM voice_ai_agents`);
    if (agentRows[0].cnt === 0) {
      await client.query(`
        INSERT INTO voice_ai_agents (name, voice_id, persona, script, status, calls_handled, avg_csat) VALUES
        ('Aria', 'voice_aria_en', 'Friendly wellness advisor — handles class bookings and general inquiries', 'Greeting: Hi, this is Aria from SohamYoga! How can I help you today?', 'active', 142, 4.7),
        ('Max', 'voice_max_en', 'Sales specialist — handles membership upgrades and pricing questions', 'Greeting: Hello! I am Max, your SohamYoga membership advisor. What plan are you interested in?', 'active', 87, 4.4),
        ('Priya', 'voice_priya_en', 'Support specialist — handles complaints, refunds, and escalations', 'Greeting: Namaste, I am Priya from the SohamYoga care team. How may I assist you?', 'active', 63, 4.2)
      `);
    }

    const { rows: callRows } = await client.query(`SELECT COUNT(*)::int AS cnt FROM voice_ai_calls`);
    if (callRows[0].cnt === 0) {
      await client.query(`
        INSERT INTO voice_ai_calls (agent_name, caller_number, direction, duration_seconds, outcome, sentiment, transcript_snippet, cost_usd, created_at) VALUES
        ('Aria', '+1-416-555-0101', 'inbound', 187, 'completed', 'positive', 'Customer booked a Saturday morning class. Very happy with the process.', 0.04, NOW() - INTERVAL '1 hour'),
        ('Max', '+1-416-555-0102', 'outbound', 312, 'sale', 'positive', 'Upgraded to annual membership. Asked about family plan options.', 0.07, NOW() - INTERVAL '2 hours'),
        ('Priya', '+1-416-555-0103', 'inbound', 420, 'escalated', 'negative', 'Complaint about class cancellation. Requested refund. Escalated to manager.', 0.09, NOW() - INTERVAL '3 hours'),
        ('Aria', '+1-416-555-0104', 'inbound', 95, 'completed', 'neutral', 'Inquiry about class schedule. Provided information.', 0.02, NOW() - INTERVAL '4 hours'),
        ('Max', '+1-416-555-0105', 'outbound', 0, 'no_answer', 'neutral', NULL, 0.00, NOW() - INTERVAL '5 hours'),
        ('Aria', '+1-416-555-0106', 'inbound', 203, 'completed', 'positive', 'First-time caller. Signed up for trial class.', 0.04, NOW() - INTERVAL '6 hours'),
        ('Priya', '+1-416-555-0107', 'inbound', 540, 'resolved', 'positive', 'Billing issue resolved. Customer satisfied with outcome.', 0.11, NOW() - INTERVAL '8 hours'),
        ('Aria', '+1-416-555-0108', 'inbound', 145, 'completed', 'positive', 'Booked private yoga session for next week.', 0.03, NOW() - INTERVAL '10 hours'),
        ('Max', '+1-416-555-0109', 'outbound', 278, 'sale', 'positive', 'Sold 3-month membership to lapsed customer.', 0.06, NOW() - INTERVAL '12 hours'),
        ('Priya', '+1-416-555-0110', 'inbound', 380, 'completed', 'neutral', 'Questions about injury-friendly classes. Referred to instructor.', 0.08, NOW() - INTERVAL '1 day'),
        ('Aria', '+1-416-555-0111', 'inbound', 112, 'completed', 'positive', 'Rescheduled class booking.', 0.02, NOW() - INTERVAL '1 day 2 hours'),
        ('Max', '+1-416-555-0112', 'outbound', 0, 'voicemail', 'neutral', 'Left voicemail about renewal offer.', 0.01, NOW() - INTERVAL '2 days'),
        ('Aria', '+1-416-555-0113', 'inbound', 265, 'completed', 'positive', 'Corporate wellness inquiry. Requested group pricing.', 0.05, NOW() - INTERVAL '2 days'),
        ('Priya', '+1-416-555-0114', 'inbound', 610, 'escalated', 'negative', 'Instructor complaint. Escalated to studio manager.', 0.13, NOW() - INTERVAL '3 days'),
        ('Max', '+1-416-555-0115', 'outbound', 195, 'sale', 'positive', 'Annual renewal secured. Offered loyalty discount.', 0.04, NOW() - INTERVAL '4 days')
      `);
    }

    const { rows: scriptRows } = await client.query(`SELECT COUNT(*)::int AS cnt FROM voice_ai_scripts`);
    if (scriptRows[0].cnt === 0) {
      const { rows: agents } = await client.query(`SELECT id FROM voice_ai_agents ORDER BY id LIMIT 3`);
      if (agents.length >= 3) {
        await client.query(`
          INSERT INTO voice_ai_scripts (agent_id, script_name, intent, utterances, response) VALUES
          ($1, 'Class Booking Flow', 'book_class', '["I want to book a class", "Can I reserve a spot", "Class booking please"]', 'I would be happy to help you book a class! What date and time works best for you, and do you have a preferred style — Hatha, Vinyasa, or Yin Yoga?'),
          ($2, 'Membership Upgrade Pitch', 'upgrade_membership', '["Tell me about memberships", "What plans do you have", "How much does it cost"]', 'We have three great plans: Monthly at $79, Quarterly at $199, and Annual at $699 — our most popular option. The annual plan saves you over 25%. Which fits your lifestyle?'),
          ($3, 'Refund Request Handler', 'refund_request', '["I want a refund", "Charge me by mistake", "Cancel my membership"]', 'I am sorry to hear you had a less than perfect experience. I can process a refund or pause your membership — whichever you prefer. Can I pull up your account?'),
          ($1, 'Schedule Information', 'get_schedule', '["When are classes", "What time is yoga", "Schedule please"]', 'Our classes run Monday through Sunday, 6AM to 8PM. Morning sessions start at 6, 8, and 10AM. Would you like me to text you the full weekly schedule?')
        `, [agents[0].id, agents[1].id, agents[2].id]);
      }
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
    const [todayRes, weekRes, monthRes, agentRes, costRes] = await Promise.all([
      client.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE outcome='completed' OR outcome='sale' OR outcome='resolved')::int AS success, ROUND(AVG(duration_seconds)::numeric,0) AS avg_duration, SUM(cost_usd)::numeric AS cost FROM voice_ai_calls WHERE created_at >= NOW() - INTERVAL '24 hours'`),
      client.query(`SELECT COUNT(*)::int AS total FROM voice_ai_calls WHERE created_at >= NOW() - INTERVAL '7 days'`),
      client.query(`SELECT COUNT(*)::int AS total FROM voice_ai_calls WHERE created_at >= NOW() - INTERVAL '30 days'`),
      client.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='active')::int AS active, ROUND(AVG(avg_csat)::numeric,2) AS avg_csat FROM voice_ai_agents`),
      client.query(`SELECT SUM(cost_usd)::numeric AS total_cost FROM voice_ai_calls WHERE created_at >= NOW() - INTERVAL '24 hours'`),
    ]);

    const today = todayRes.rows[0] ?? { total: 0, success: 0, avg_duration: 0, cost: 0 };
    const successRate = today.total > 0 ? Math.round((today.success / today.total) * 100) : 0;
    const avgCsat = agentRes.rows[0]?.avg_csat ?? 0;

    const volumeScore = today.total >= 5 ? 34 : today.total > 0 ? 20 : 0;
    const successScore = successRate >= 70 ? 33 : successRate >= 50 ? 20 : 0;
    const csatScore = Number(avgCsat) >= 4.5 ? 33 : Number(avgCsat) >= 4.0 ? 20 : 0;
    const health_score = Math.min(100, volumeScore + successScore + csatScore);

    return Response.json({
      health_score,
      traffic_light: health_score >= 70 ? 'green' : health_score >= 40 ? 'yellow' : 'red',
      kpis: [
        { label: 'Calls Today', value: today.total, target: 10, trend: today.total >= 5 ? 'up' : 'down', unit: 'calls' },
        { label: 'Calls This Week', value: weekRes.rows[0]?.total ?? 0, target: 50, trend: (weekRes.rows[0]?.total ?? 0) >= 30 ? 'up' : 'down', unit: 'calls' },
        { label: 'Success Rate', value: successRate, target: 70, trend: successRate >= 70 ? 'up' : 'down', unit: '%' },
        { label: 'Avg Duration', value: today.avg_duration ?? 0, target: 180, trend: (today.avg_duration ?? 0) <= 300 ? 'up' : 'down', unit: 'sec' },
        { label: 'Cost Today', value: Number(costRes.rows[0]?.total_cost ?? 0).toFixed(2), target: 5, trend: Number(costRes.rows[0]?.total_cost ?? 0) <= 5 ? 'up' : 'down', unit: 'USD' },
        { label: 'Avg CSAT', value: Number(avgCsat).toFixed(1), target: 4.5, trend: Number(avgCsat) >= 4.5 ? 'up' : 'down', unit: '/5' },
      ],
      updated_at: new Date().toISOString(),
    });
  } finally {
    client.release();
  }
}
