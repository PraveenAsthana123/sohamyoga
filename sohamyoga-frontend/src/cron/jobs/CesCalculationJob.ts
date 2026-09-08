// CesCalculationJob — computes a real CES (Customer Effort Score, top-2-box)
// from submitted survey_answer rows on 'ces'-type surveys with a
// rating_scale question, mirroring CsatCalculationJob.ts exactly. Needed
// its own survey type (migration 151) to be distinguishable from a CSAT
// "how satisfied" question -- both are rating_scale, only the survey's
// type tells them apart.
import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

export function cesCategory(score: number | null): string {
  if (score === null) return 'no_data';
  if (score >= 80) return 'low_effort';
  if (score >= 50) return 'moderate_effort';
  return 'high_effort';
}

export async function run(): Promise<void> {
  const surveys = await db.query<{ id: string; title: string }>(`SELECT id, title FROM survey WHERE type = 'ces'`);

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

    // Top-2-box on the question's own scale, same convention as CSAT. The
    // question is expected to be phrased so a HIGH rating = LOW effort
    // (e.g. "How easy was it to book a class?" 1=very difficult..5=very easy)
    // so top-2-box directly reads as "low effort" share.
    const topBoxThreshold = q.rating_max - 1;
    const lowEffort = values.filter(v => v >= topBoxThreshold).length;
    const cesScore = Math.round((lowEffort / values.length) * 10000) / 100;

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
      `INSERT INTO survey_analytics (survey_id, total_responses, completed_responses, partial_responses, completion_rate, average_time_seconds, ces_score, calculated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,now())
       ON CONFLICT (survey_id) DO UPDATE SET
         total_responses = EXCLUDED.total_responses, completed_responses = EXCLUDED.completed_responses,
         partial_responses = EXCLUDED.partial_responses, completion_rate = EXCLUDED.completion_rate,
         average_time_seconds = EXCLUDED.average_time_seconds, ces_score = EXCLUDED.ces_score, calculated_at = now()
       RETURNING id`,
      [survey.id, total, completed, Number(rc.partial),
        total ? Math.round((completed / total) * 10000) / 100 : 0,
        Math.round(Number(rc.avg_seconds ?? 0)), cesScore],
    );

    await db.query(
      `INSERT INTO survey_question_summary (analytics_id, question_id, question_text, question_type, total_answers, option_counts)
       VALUES ($1,$2,$3,'rating_scale',$4,$5)
       ON CONFLICT (analytics_id, question_id) DO UPDATE SET
         total_answers = EXCLUDED.total_answers, option_counts = EXCLUDED.option_counts, calculated_at = now()`,
      [analytics.rows[0].id, q.id, q.text, values.length, JSON.stringify({ lowEffort, total: values.length, scale: `${q.rating_min}-${q.rating_max}` })],
    );
    updated++;
  }

  console.log(`[ces-calculation] surveys=${surveys.rows.length} updated=${updated}`);
  // Do NOT db.end() here — see NotificationRetryJob.ts.
}
