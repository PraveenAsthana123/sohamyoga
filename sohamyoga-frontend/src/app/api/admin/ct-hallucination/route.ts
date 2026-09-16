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
      CREATE TABLE IF NOT EXISTS hallucination_checks (
        id SERIAL PRIMARY KEY,
        model_name TEXT DEFAULT 'llama3.2',
        prompt TEXT,
        response TEXT,
        check_type TEXT DEFAULT 'factual',
        hallucination_detected BOOLEAN DEFAULT FALSE,
        confidence NUMERIC DEFAULT 0,
        evidence TEXT,
        checked_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS hallucination_rules (
        id SERIAL PRIMARY KEY,
        name TEXT,
        check_type TEXT,
        pattern TEXT,
        enabled BOOLEAN DEFAULT TRUE,
        detections INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Seed default rules
    const { rows: ruleCount } = await client.query('SELECT COUNT(*)::int AS c FROM hallucination_rules');
    if (ruleCount[0].c === 0) {
      await client.query(`INSERT INTO hallucination_rules (name, check_type, pattern, detections) VALUES
        ('Date Verification', 'date_check', 'Check if dates mentioned are plausible and consistent', 12),
        ('Citation Accuracy', 'citation_check', 'Verify cited sources and statistics exist', 8),
        ('Numeric Consistency', 'number_check', 'Check if numbers are internally consistent and plausible', 5)`);
    }

    // Seed sample checks
    const { rows: checkCount } = await client.query('SELECT COUNT(*)::int AS c FROM hallucination_checks');
    if (checkCount[0].c === 0) {
      await client.query(`INSERT INTO hallucination_checks (model_name, prompt, response, check_type, hallucination_detected, confidence, evidence, checked_at) VALUES
        ('llama3.2', 'What is the capital of France?', 'Paris is the capital of France.', 'factual', false, 0.98, 'Verified correct', NOW() - INTERVAL '1 hour'),
        ('llama3.2', 'When was the Eiffel Tower built?', 'The Eiffel Tower was built in 1850.', 'date_check', true, 0.92, 'Actual date: 1889', NOW() - INTERVAL '2 hours'),
        ('llama3.2', 'How many yoga studios are in Canada?', 'There are exactly 50,000 yoga studios in Canada.', 'number_check', true, 0.85, 'Unverifiable precise claim', NOW() - INTERVAL '3 hours'),
        ('llama3.2', 'What are benefits of yoga?', 'Yoga improves flexibility, strength and mental well-being.', 'factual', false, 0.95, 'Well-documented benefits', NOW() - INTERVAL '4 hours'),
        ('llama3.2', 'Who founded Yoga?', 'Yoga was founded by Patanjali around 400 CE.', 'factual', false, 0.80, 'Partially correct - Patanjali codified but did not found', NOW() - INTERVAL '5 hours'),
        ('llama3.2', 'What is the revenue of Lululemon in 2030?', 'Lululemon revenue in 2030 will be $15 billion.', 'factual', true, 0.99, 'Future prediction presented as fact', NOW() - INTERVAL '6 hours'),
        ('llama3.2', 'Summarize Harvard study on meditation', 'Harvard 2023 study found 78% reduction in anxiety.', 'citation_check', true, 0.88, 'No such specific study verified', NOW() - INTERVAL '7 hours'),
        ('llama3.2', 'What time zone is Toronto in?', 'Toronto is in Eastern Time (ET).', 'factual', false, 0.99, 'Correct', NOW() - INTERVAL '8 hours'),
        ('llama3.2', 'How many calories does yoga burn?', 'Yoga burns between 180-460 calories per hour.', 'number_check', false, 0.90, 'Plausible range verified', NOW() - INTERVAL '9 hours'),
        ('llama3.2', 'What is the average price of a yoga class?', 'The average yoga class costs exactly $27.43 in Canada.', 'number_check', true, 0.75, 'Overly precise, unverifiable', NOW() - INTERVAL '10 hours')`);
    }

    const [statsRes, rulesRes] = await Promise.all([
      client.query(`
        SELECT
          COUNT(*)::int AS total_checks,
          COUNT(*) FILTER (WHERE hallucination_detected = TRUE)::int AS detected,
          ROUND(AVG(confidence)::numeric, 3) AS avg_confidence,
          COUNT(*) FILTER (WHERE checked_at >= NOW() - INTERVAL '24 hours')::int AS checks_today
        FROM hallucination_checks
      `).catch(() => ({ rows: [{ total_checks: 0, detected: 0, avg_confidence: 0, checks_today: 0 }] })),
      client.query(`SELECT COUNT(*) FILTER (WHERE enabled = TRUE)::int AS active_rules FROM hallucination_rules`).catch(() => ({ rows: [{ active_rules: 0 }] })),
    ]);

    const st = statsRes.rows[0];
    const totalChecks = parseInt(st.total_checks) || 1;
    const detected = parseInt(st.detected) || 0;
    const detectionRate = Math.round((detected / totalChecks) * 100);
    const modelAccuracy = Math.round((1 - detected / totalChecks) * 100);
    const activeRules = rulesRes.rows[0].active_rules;

    const health_score = Math.min(100,
      (modelAccuracy >= 90 ? 50 : modelAccuracy >= 75 ? 30 : 10) +
      (activeRules >= 3 ? 30 : activeRules >= 1 ? 15 : 0) +
      (detectionRate <= 10 ? 20 : detectionRate <= 25 ? 10 : 5)
    );

    return Response.json({
      health_score,
      traffic_light: modelAccuracy >= 90 ? 'green' : modelAccuracy >= 75 ? 'yellow' : 'red',
      detection_rate: detectionRate,
      model_accuracy: modelAccuracy,
      active_rules: activeRules,
      total_checks: totalChecks,
      detected,
      checks_today: st.checks_today,
      kpis: [
        { label: 'Detection Rate', value: detectionRate, target: 10, trend: detectionRate <= 10 ? 'up' : 'down', unit: '%' },
        { label: 'Model Accuracy', value: modelAccuracy, target: 90, trend: modelAccuracy >= 90 ? 'up' : 'down', unit: '%' },
        { label: 'Active Rules', value: activeRules, target: 5, trend: activeRules >= 5 ? 'up' : 'down', unit: 'rules' },
        { label: 'Checks Today', value: st.checks_today, target: 20, trend: st.checks_today >= 20 ? 'up' : 'down', unit: 'checks' },
      ],
      updated_at: new Date().toISOString(),
    });
  } finally {
    client.release();
  }
}
