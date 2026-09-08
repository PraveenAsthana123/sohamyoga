import { query } from '@/lib/postgres';

export interface AttributeQuadrant {
  attribute: string;
  importance: number;
  satisfaction: number;
  respondentCount: number;
  quadrant: 'fix_first' | 'maintain' | 'low_priority' | 'overinvested';
}

interface QuestionRow { id: string; text: string; rating_min: number; rating_max: number }

/** Real Importance x Satisfaction Matrix -- reuses the existing rating_scale
 * survey_question/survey_answer infrastructure via a naming convention
 * ("Importance: <attribute>" / "Satisfaction: <attribute>" question pairs
 * in the same survey), rather than inventing new schema. Requires the
 * survey to actually contain matched pairs -- an attribute with only one
 * side answered is reported as such, never guessed. */
export async function computeImportanceSatisfactionMatrix(surveyId: string): Promise<AttributeQuadrant[]> {
  const questions = await query<QuestionRow>(
    `SELECT id, text, rating_min, rating_max FROM survey_question
     WHERE survey_id = $1 AND type = 'rating_scale' AND (text ILIKE 'Importance:%' OR text ILIKE 'Satisfaction:%')`,
    [surveyId]
  );

  const importanceByAttr = new Map<string, QuestionRow>();
  const satisfactionByAttr = new Map<string, QuestionRow>();
  for (const q of questions.rows) {
    if (q.text.toLowerCase().startsWith('importance:')) importanceByAttr.set(q.text.slice(11).trim().toLowerCase(), q);
    else if (q.text.toLowerCase().startsWith('satisfaction:')) satisfactionByAttr.set(q.text.slice(13).trim().toLowerCase(), q);
  }

  const attributes = new Set([...importanceByAttr.keys(), ...satisfactionByAttr.keys()]);
  const results: AttributeQuadrant[] = [];

  for (const attr of attributes) {
    const impQ = importanceByAttr.get(attr);
    const satQ = satisfactionByAttr.get(attr);
    if (!impQ || !satQ) continue; // incomplete pair -- skip rather than fabricate the missing side

    const [impAvg, satAvg] = await Promise.all([
      query<{ avg: string | null; n: string }>('SELECT avg(value_number)::text AS avg, count(value_number)::text AS n FROM survey_answer WHERE question_id = $1', [impQ.id]),
      query<{ avg: string | null; n: string }>('SELECT avg(value_number)::text AS avg, count(value_number)::text AS n FROM survey_answer WHERE question_id = $1', [satQ.id]),
    ]);
    if (impAvg.rows[0].avg === null || satAvg.rows[0].avg === null) continue; // no real answers yet -- skip, don't fabricate

    const importance = Number(impAvg.rows[0].avg);
    const satisfaction = Number(satAvg.rows[0].avg);
    const impMid = (impQ.rating_min + impQ.rating_max) / 2;
    const satMid = (satQ.rating_min + satQ.rating_max) / 2;

    const quadrant: AttributeQuadrant['quadrant'] =
      importance >= impMid && satisfaction < satMid ? 'fix_first' :
      importance >= impMid && satisfaction >= satMid ? 'maintain' :
      importance < impMid && satisfaction >= satMid ? 'overinvested' : 'low_priority';

    results.push({
      attribute: attr.replace(/\b\w/g, (c) => c.toUpperCase()),
      importance: Math.round(importance * 10) / 10,
      satisfaction: Math.round(satisfaction * 10) / 10,
      respondentCount: Math.min(Number(impAvg.rows[0].n), Number(satAvg.rows[0].n)),
      quadrant,
    });
  }

  return results;
}
