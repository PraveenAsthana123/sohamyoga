// NpsCalculationJob — computes real NPS scores from submitted survey_answer
// rows. survey_analytics.nps_score / survey_question_summary.promoters etc.
// were schema-only with no writer anywhere (SurveyAnalytics.npsCategory()
// only buckets a pre-supplied number — nothing ever computed one). Standard
// formula: promoters (9-10) minus detractors (0-6), as a percent of total,
// passives (7-8) excluded from the formula but still counted.
//
// Free-text answers are classified via the same Ollama sentiment classifier
// built earlier this session (src/lib/sentiment.ts) — no new classifier
// needed. Sentiment counts are stored in survey_question_summary.option_counts
// (a generic JSONB column, not restricted to choice-question option tallies).

import { Pool } from 'pg';
import { classifySentiment } from '@/lib/sentiment';

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const TEXT_SAMPLE_LIMIT = 5;

function npsCategory(score: number | null): string {
  if (score === null) return 'no_data';
  if (score >= 70) return 'excellent';
  if (score >= 30) return 'good';
  if (score >= 0) return 'needs_improvement';
  return 'critical';
}

export async function run(): Promise<void> {
  const surveys = await db.query<{ id: string; title: string }>(`SELECT id, title FROM survey WHERE type = 'nps'`);

  let updated = 0;
  for (const survey of surveys.rows) {
    const responseCounts = await db.query<{ total: string; completed: string; partial: string; avg_seconds: string | null }>(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE status = 'submitted') AS completed,
              COUNT(*) FILTER (WHERE status = 'partial') AS partial,
              AVG(time_spent_seconds) AS avg_seconds
       FROM survey_response WHERE survey_id = $1`,
      [survey.id],
    );
    const rc = responseCounts.rows[0];
    const total = Number(rc.total);
    const completed = Number(rc.completed);

    const npsQuestion = await db.query<{ id: string; text: string }>(
      `SELECT id, text FROM survey_question WHERE survey_id = $1 AND type = 'nps' LIMIT 1`,
      [survey.id],
    );
    let overallNpsScore: number | null = null;
    if (npsQuestion.rows[0]) {
      const scores = await db.query<{ value_number: string }>(
        `SELECT a.value_number FROM survey_answer a
         JOIN survey_response r ON r.id = a.response_id
         WHERE a.question_id = $1 AND r.status = 'submitted'`,
        [npsQuestion.rows[0].id],
      );
      const values = scores.rows.map(r => Number(r.value_number));
      if (values.length) {
        const promoters = values.filter(v => v >= 9).length;
        const passives = values.filter(v => v >= 7 && v <= 8).length;
        const detractors = values.filter(v => v <= 6).length;
        overallNpsScore = Math.round(((promoters - detractors) / values.length) * 10000) / 100;

        const analytics = await db.query<{ id: string }>(
          `INSERT INTO survey_analytics (survey_id, total_responses, completed_responses, partial_responses, completion_rate, average_time_seconds, nps_score, calculated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,now())
           ON CONFLICT (survey_id) DO UPDATE SET
             total_responses = EXCLUDED.total_responses, completed_responses = EXCLUDED.completed_responses,
             partial_responses = EXCLUDED.partial_responses, completion_rate = EXCLUDED.completion_rate,
             average_time_seconds = EXCLUDED.average_time_seconds, nps_score = EXCLUDED.nps_score, calculated_at = now()
           RETURNING id`,
          [survey.id, total, completed, Number(rc.partial),
            total ? Math.round((completed / total) * 10000) / 100 : 0,
            Math.round(Number(rc.avg_seconds ?? 0)), overallNpsScore],
        );
        const analyticsId = analytics.rows[0].id;

        await db.query(
          `INSERT INTO survey_question_summary (analytics_id, question_id, question_text, question_type, total_answers, nps_score, promoters, passives, detractors)
           VALUES ($1,$2,$3,'nps',$4,$5,$6,$7,$8)
           ON CONFLICT (analytics_id, question_id) DO UPDATE SET
             total_answers = EXCLUDED.total_answers, nps_score = EXCLUDED.nps_score,
             promoters = EXCLUDED.promoters, passives = EXCLUDED.passives, detractors = EXCLUDED.detractors, calculated_at = now()`,
          [analyticsId, npsQuestion.rows[0].id, npsQuestion.rows[0].text, values.length, overallNpsScore, promoters, passives, detractors],
        );

        const textQuestion = await db.query<{ id: string; text: string }>(
          `SELECT id, text FROM survey_question WHERE survey_id = $1 AND type = 'long_text' LIMIT 1`,
          [survey.id],
        );
        if (textQuestion.rows[0]) {
          const texts = await db.query<{ value_text: string }>(
            `SELECT a.value_text FROM survey_answer a
             JOIN survey_response r ON r.id = a.response_id
             WHERE a.question_id = $1 AND r.status = 'submitted' AND a.value_text IS NOT NULL
             ORDER BY a.answered_at DESC LIMIT 100`,
            [textQuestion.rows[0].id],
          );
          const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
          for (const t of texts.rows) {
            try {
              const result = await classifySentiment(t.value_text);
              sentimentCounts[result.sentiment]++;
            } catch { /* one classification failure shouldn't drop the whole summary */ }
          }
          await db.query(
            `INSERT INTO survey_question_summary (analytics_id, question_id, question_text, question_type, total_answers, option_counts, text_sample)
             VALUES ($1,$2,$3,'long_text',$4,$5,$6)
             ON CONFLICT (analytics_id, question_id) DO UPDATE SET
               total_answers = EXCLUDED.total_answers, option_counts = EXCLUDED.option_counts, text_sample = EXCLUDED.text_sample, calculated_at = now()`,
            [analyticsId, textQuestion.rows[0].id, textQuestion.rows[0].text, texts.rows.length,
              JSON.stringify(sentimentCounts), texts.rows.slice(0, TEXT_SAMPLE_LIMIT).map(t => t.value_text)],
          );
        }
        updated++;
      }
    }
  }

  console.log(`[nps-calculation] surveys=${surveys.rows.length} updated=${updated}`);
  // Do NOT db.end() here — see NotificationRetryJob.ts.
}

export { npsCategory };
