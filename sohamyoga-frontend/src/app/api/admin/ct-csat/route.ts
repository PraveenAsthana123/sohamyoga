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
    // Ensure tables exist with sample data
    await client.query(`
      CREATE TABLE IF NOT EXISTS csat_surveys (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS csat_responses (
        id SERIAL PRIMARY KEY,
        survey_id INTEGER,
        score NUMERIC CHECK (score >= 1 AND score <= 5),
        nps_score INTEGER CHECK (nps_score >= 0 AND nps_score <= 10),
        comment TEXT,
        classification TEXT DEFAULT 'general',
        escalated BOOLEAN DEFAULT FALSE,
        responded_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Seed if empty
    const { rows: existing } = await client.query('SELECT COUNT(*)::int AS c FROM csat_surveys');
    if (existing[0].c === 0) {
      await client.query(`INSERT INTO csat_surveys (title, description) VALUES
        ('Post-Class Survey', 'How was your class experience?'),
        ('Instructor Feedback', 'Rate your instructor'),
        ('App Experience', 'How easy is our app to use?')`);
      await client.query(`INSERT INTO csat_responses (survey_id, score, nps_score, comment, classification, escalated, responded_at) VALUES
        (1, 5, 9, 'Amazing class!', 'experience', false, NOW() - INTERVAL '1 day'),
        (1, 4, 8, 'Good instructor', 'instructor', false, NOW() - INTERVAL '2 days'),
        (1, 3, 6, 'Room was too cold', 'facilities', true, NOW() - INTERVAL '3 days'),
        (2, 5, 10, 'Best instructor ever', 'instructor', false, NOW() - INTERVAL '4 days'),
        (2, 2, 3, 'Very disappointed', 'experience', true, NOW() - INTERVAL '5 days'),
        (3, 4, 7, 'App works well', 'technology', false, NOW() - INTERVAL '6 days'),
        (3, 5, 9, 'Love the booking system', 'technology', false, NOW() - INTERVAL '7 days'),
        (1, 4, 8, 'Great experience', 'experience', false, NOW() - INTERVAL '8 days'),
        (1, 3, 5, 'Average class', 'experience', false, NOW() - INTERVAL '9 days'),
        (2, 5, 10, 'Excellent!', 'instructor', false, NOW() - INTERVAL '10 days')`);
    }

    const [statsRes, escalationsRes, responseRateRes] = await Promise.all([
      client.query(`
        SELECT
          ROUND(AVG(score)::numeric, 2) AS avg_csat,
          COUNT(*)::int AS total_responses,
          COUNT(*) FILTER (WHERE responded_at >= date_trunc('month', NOW()))::int AS responses_this_month,
          COUNT(*) FILTER (WHERE nps_score >= 9)::int AS promoters,
          COUNT(*) FILTER (WHERE nps_score <= 6)::int AS detractors,
          COUNT(*)::int AS total_nps
        FROM csat_responses
      `).catch(() => ({ rows: [{ avg_csat: 0, total_responses: 0, responses_this_month: 0, promoters: 0, detractors: 0, total_nps: 0 }] })),
      client.query(`SELECT COUNT(*)::int AS open FROM csat_responses WHERE escalated = TRUE`).catch(() => ({ rows: [{ open: 0 }] })),
      client.query(`SELECT COUNT(*)::int AS surveys FROM csat_surveys WHERE status = 'active'`).catch(() => ({ rows: [{ surveys: 0 }] })),
    ]);

    const st = statsRes.rows[0];
    const avgCsat = parseFloat(st.avg_csat) || 0;
    const totalNps = parseInt(st.total_nps) || 1;
    const promoters = parseInt(st.promoters) || 0;
    const detractors = parseInt(st.detractors) || 0;
    const nps = Math.round(((promoters - detractors) / totalNps) * 100);
    const escalationsOpen = escalationsRes.rows[0].open;
    const activeSurveys = responseRateRes.rows[0].surveys;
    const responseRate = totalNps > 0 ? Math.min(100, Math.round((parseInt(st.responses_this_month) / Math.max(1, totalNps)) * 100)) : 0;

    const health_score = Math.min(100,
      (avgCsat >= 4.5 ? 40 : avgCsat >= 3.5 ? 25 : 10) +
      (nps >= 50 ? 30 : nps >= 20 ? 15 : 5) +
      (escalationsOpen === 0 ? 30 : escalationsOpen <= 2 ? 15 : 5)
    );

    return Response.json({
      health_score,
      traffic_light: avgCsat >= 4.5 ? 'green' : avgCsat >= 3.5 ? 'yellow' : 'red',
      avg_csat: avgCsat,
      nps,
      escalation_rate: escalationsOpen,
      response_rate: responseRate,
      kpis: [
        { label: 'Avg CSAT Score', value: avgCsat.toFixed(1), target: 4.5, trend: avgCsat >= 4.5 ? 'up' : 'down', unit: '/5' },
        { label: 'NPS Score', value: nps, target: 50, trend: nps >= 50 ? 'up' : 'down', unit: 'pts' },
        { label: 'Responses (Month)', value: st.responses_this_month, target: 50, trend: st.responses_this_month >= 50 ? 'up' : 'down', unit: 'responses' },
        { label: 'Escalations Open', value: escalationsOpen, target: 0, trend: escalationsOpen === 0 ? 'up' : 'down', unit: 'open' },
        { label: 'Active Surveys', value: activeSurveys, target: 3, trend: activeSurveys >= 3 ? 'up' : 'down', unit: 'surveys' },
      ],
      updated_at: new Date().toISOString(),
    });
  } finally {
    client.release();
  }
}
