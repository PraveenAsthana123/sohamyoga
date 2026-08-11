// ChurnPredictionJob — Weekly Monday 07:00 UTC
// Scores churn risk for all active members using Ollama.
// Flags members > 14 days inactive with active membership.
// Output is advisory ONLY — no auto-cancellations.
//
// Rewritten against the live schema: attendance_record has no `date` column
// (attended_at); streak keys off user_id with no is_active column; `student`
// has no `role` column at all — staff/admin lookup is on app_user.role
// (enum: owner/admin/staff/teacher/student/guest), not student; and
// notification_queue needs recipient_user_id/recipient_address/type.

import { Pool } from 'pg';
import { ollama } from '../OllamaClient';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const SYSTEM = `You are a customer retention analyst.
Given member engagement data, return ONLY valid JSON:
{"risk_score": 0-100, "risk_level": "low"|"medium"|"high"|"critical", "top_reason": "string", "suggested_action": "string"}
Risk score 0=no risk, 100=certain churn. No markdown.`;

function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || text;
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Ollama returned no JSON object');
  return JSON.parse(fenced.slice(start, end + 1)) as T;
}

export async function run(): Promise<void> {
  const at_risk = await db.query<{
    student_id: string; tenant_id: string; email: string;
    days_since_last_class: number | null; membership_status: string;
    current_streak: number; total_classes: number; join_date: string;
  }>(`
    SELECT
      s.id AS student_id,
      s.tenant_id,
      s.email,
      EXTRACT(DAY FROM NOW() - MAX(ar.attended_at))::int AS days_since_last_class,
      e.status AS membership_status,
      COALESCE(st.current_streak, 0) AS current_streak,
      COUNT(ar.id)::int AS total_classes,
      s.created_at::date::text AS join_date
    FROM student s
    JOIN enrollment e ON e.student_id = s.id AND e.status = 'active'
    LEFT JOIN attendance_record ar ON ar.student_id = s.id AND ar.status = 'present'
    LEFT JOIN streak st ON st.user_id = s.user_id
    WHERE s.status = 'active'
    GROUP BY s.id, s.tenant_id, s.email, e.status, st.current_streak, s.created_at
    HAVING EXTRACT(DAY FROM NOW() - MAX(ar.attended_at)) >= 7
       OR MAX(ar.attended_at) IS NULL
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
      try { score = extractJson(raw); } catch (parseErr) {
        console.error(`[churn-prediction] student ${m.student_id}: unparseable Ollama response:`, parseErr);
        continue;
      }

      await db.query(
        `INSERT INTO churn_prediction
           (student_id, tenant_id, predicted_at, risk_score, risk_level, top_reason, suggested_action)
         VALUES ($1,$2,NOW(),$3,$4,$5,$6)
         ON CONFLICT (student_id) DO UPDATE SET
           predicted_at=NOW(), risk_score=$3, risk_level=$4,
           top_reason=$5, suggested_action=$6, updated_at=NOW()`,
        [m.student_id, m.tenant_id, Math.max(0, Math.min(100, score.risk_score)),
          score.risk_level, score.top_reason, score.suggested_action],
      );

      if (['high', 'critical'].includes(score.risk_level)) {
        const admin = await db.query<{ id: string; email: string }>(
          `SELECT id, email FROM app_user WHERE tenant_id=$1 AND role='admin' AND status='active' LIMIT 1`,
          [m.tenant_id],
        );
        if (admin.rows[0]) {
          await db.query(
            `INSERT INTO notification_queue
               (tenant_id, template_slug, channel, type, recipient_user_id, recipient_address, payload, idempotency_key)
             VALUES ($1,'churn_alert','in_app','alert',$2,$3,$4,$5)
             ON CONFLICT (tenant_id, idempotency_key) DO NOTHING`,
            [m.tenant_id, admin.rows[0].id, admin.rows[0].email,
              JSON.stringify({ studentId: m.student_id, riskLevel: score.risk_level, daysInactive: m.days_since_last_class }),
              `churn_${m.student_id}_${new Date().toISOString().slice(0, 10)}`],
          );
        }
      }

      scored++;
    } catch (err) {
      console.error(`[churn-prediction] student ${m.student_id}:`, err);
    }
  }

  console.log(`[churn-prediction] scored=${scored}/${at_risk.rows.length} members`);
  // Do NOT db.end() here — runner.ts caches this module across every
  // scheduled invocation in the long-lived cron container; ending the pool
  // breaks every run after the first.
}
