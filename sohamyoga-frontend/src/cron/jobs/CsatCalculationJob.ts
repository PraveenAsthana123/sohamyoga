// CsatCalculationJob — computes a real CSAT (top-2-box) score from
// submitted survey_answer rows on 'feedback'-type surveys with a
// rating_scale question, mirroring NpsCalculationJob.ts exactly. No new
// survey system -- reuses the existing real survey/survey_question/
// survey_response/survey_analytics tables.
import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

export function csatCategory(score: number | null): string {
  if (score === null) return 'no_data';
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'needs_improvement';
  return 'critical';
}

export async function run(): Promise<void> {
  const surveys = await db.query<{ id: string; title: string }>(`SELECT id, title FROM survey WHERE type = 'feedback'`);

  let updated = 0;
  for (const survey of surveys.rows) {
    const ratingQuestion = await db.query<{ id: string; text: string; rating_min: number | null; rating_max: number | null }>(
      `SELECT id, text, rating_min, rating_max FROM survey_question WHERE survey_id = $1 AND type = 'rating_scale' LIMIT 1`,
      [survey.id],
    );
    const q = ratingQuestion.rows[0];
    if (!q || q.rating_min === null || q.rating_max === null) continue;

    const answers = await db.query<{ value_number: string }>(
      `SELECT a.value_number FROM survey_answer a
       JOIN survey_response r ON r.id = a.response_id
       WHERE a.question_id = $1 AND r.status = 'submitted' AND a.value_number IS NOT NULL`,
      [q.id],
    );
    const values = answers.rows.map(r => Number(r.value_number));
    if (!values.length) continue;

    // Top-2-box: the two highest values on the question's own real scale,
    // not a hardcoded 4-5 assuming a 1-5 scale.
    const topBoxThreshold = q.rating_max - 1;
    const satisfied = values.filter(v => v >= topBoxThreshold).length;
    const csatScore = Math.round((satisfied / values.length) * 10000) / 100;

    const responseCounts = await db.query<{ total: string; completed: string; partial: string; avg_seconds: string | null }>(
      `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'submitted') AS completed,
              COUNT(*) FILTER (WHERE status = 'partial') AS partial, AVG(time_spent_seconds) AS avg_seconds
       FROM survey_response WHERE survey_id = $1`,
      [survey.id],
    );
    const rc = responseCounts.rows[0];
    const total = Number(rc.total);
    const completed = Number(rc.completed);

    const analytics = await db.query<{ id: string }>(
      `INSERT INTO survey_analytics (survey_id, total_responses, completed_responses, partial_responses, completion_rate, average_time_seconds, csat_score, calculated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,now())
       ON CONFLICT (survey_id) DO UPDATE SET
         total_responses = EXCLUDED.total_responses, completed_responses = EXCLUDED.completed_responses,
         partial_responses = EXCLUDED.partial_responses, completion_rate = EXCLUDED.completion_rate,
         average_time_seconds = EXCLUDED.average_time_seconds, csat_score = EXCLUDED.csat_score, calculated_at = now()
       RETURNING id`,
      [survey.id, total, completed, Number(rc.partial),
        total ? Math.round((completed / total) * 10000) / 100 : 0,
        Math.round(Number(rc.avg_seconds ?? 0)), csatScore],
    );

    await db.query(
      `INSERT INTO survey_question_summary (analytics_id, question_id, question_text, question_type, total_answers, option_counts)
       VALUES ($1,$2,$3,'rating_scale',$4,$5)
       ON CONFLICT (analytics_id, question_id) DO UPDATE SET
         total_answers = EXCLUDED.total_answers, option_counts = EXCLUDED.option_counts, calculated_at = now()`,
      [analytics.rows[0].id, q.id, q.text, values.length, JSON.stringify({ satisfied, total: values.length, scale: `${q.rating_min}-${q.rating_max}` })],
    );
    updated++;
  }

  console.log(`[csat-calculation] surveys=${surveys.rows.length} updated=${updated}`);
  // Do NOT db.end() here — see NotificationRetryJob.ts.
}
