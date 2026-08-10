// ChurnPredictionJob — Weekly Monday 07:00 UTC
// Scores churn risk for all active members using Ollama.
// Flags members > 14 days inactive with active membership.
// Output is advisory ONLY — no auto-cancellations.

import { Pool } from 'pg';
import { ollama } from '../OllamaClient';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const SYSTEM = `You are a customer retention analyst.
Given member engagement data, return ONLY valid JSON:
{"risk_score": 0-100, "risk_level": "low"|"medium"|"high"|"critical", "top_reason": "string", "suggested_action": "string"}
Risk score 0=no risk, 100=certain churn. No markdown.`;

export async function run(): Promise<void> {
  const at_risk = await db.query<{
    student_id: string; tenant_id: string; email: string;
    days_since_last_class: number; membership_status: string;
    current_streak: number; total_classes: number; join_date: string;
    wellness_trend: string | null;
  }>(`
    SELECT
      s.id AS student_id,
      s.tenant_id,
      s.email,
      EXTRACT(DAY FROM NOW() - MAX(ar.date))::int AS days_since_last_class,
      e.status AS membership_status,
      COALESCE(st.current_streak, 0) AS current_streak,
      COUNT(ar.id)::int AS total_classes,
      s.created_at::date::text AS join_date,
      NULL::text AS wellness_trend
    FROM student s
    JOIN enrollment e ON e.student_id = s.id AND e.status = 'active'
    LEFT JOIN attendance_record ar ON ar.student_id = s.id AND ar.status = 'present'
    LEFT JOIN streak st ON st.student_id = s.id AND st.is_active = true
    WHERE s.status = 'active'
    GROUP BY s.id, s.tenant_id, s.email, e.status, st.current_streak, s.created_at
    HAVING EXTRACT(DAY FROM NOW() - MAX(ar.date)) >= 7
       OR MAX(ar.date) IS NULL
  `);

  let scored = 0;

  for (const m of at_risk.rows) {
    try {
      const prompt = [
        `Days since last class: ${m.days_since_last_class ?? 'never'}`,
        `Membership: ${m.membership_status}`,
        `Streak: ${m.current_streak} days`,
        `Total classes attended: ${m.total_classes}`,
        `Member since: ${m.join_date}`,
      ].join('\n');

      const raw = await ollama.generate(prompt, { tier: 'fast', system: SYSTEM, maxTokens: 200 });

      let score: { risk_score: number; risk_level: string; top_reason: string; suggested_action: string };
      try { score = JSON.parse(raw); } catch { continue; }

      // Upsert churn prediction
      await db.query(`
        INSERT INTO churn_prediction
          (student_id, tenant_id, predicted_at, risk_score, risk_level, top_reason, suggested_action)
        VALUES ($1, $2, NOW(), $3, $4, $5, $6)
        ON CONFLICT (student_id) DO UPDATE SET
          predicted_at=NOW(), risk_score=$3, risk_level=$4,
          top_reason=$5, suggested_action=$6, updated_at=NOW()
      `, [m.student_id, m.tenant_id,
          Math.max(0, Math.min(100, score.risk_score)),
          score.risk_level, score.top_reason, score.suggested_action]);

      // Alert staff for high/critical risk
      if (['high', 'critical'].includes(score.risk_level)) {
        await db.query(`
          INSERT INTO notification_queue
            (tenant_id, recipient_id, channel, template_slug, payload, idempotency_key)
          SELECT tenant_id, id, 'in_app', 'churn_alert',
            jsonb_build_object('student_id', $1, 'risk_level', $2, 'days_inactive', $3),
            'churn_' || $1 || '_' || TO_CHAR(NOW(),'IYYY-IW')
          FROM student WHERE role='admin' AND tenant_id=$4 LIMIT 1
          ON CONFLICT (idempotency_key) DO NOTHING
        `, [m.student_id, score.risk_level, m.days_since_last_class, m.tenant_id]);
      }

      scored++;
    } catch (err) {
      console.error(`[churn-prediction] student ${m.student_id}:`, err);
    }
  }

  console.log(`[churn-prediction] scored=${scored}/${at_risk.rows.length} members`);
  await db.end();
}
