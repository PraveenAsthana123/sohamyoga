import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });

  // Ensure tables exist
  await query(`CREATE TABLE IF NOT EXISTS survey_question (
    id SERIAL PRIMARY KEY,
    survey_id INT NOT NULL,
    question_text TEXT NOT NULL,
    question_type VARCHAR(30),
    options JSONB DEFAULT '[]',
    required BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    logic_rules JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`, []);

  await query(`CREATE TABLE IF NOT EXISTS survey_response (
    id SERIAL PRIMARY KEY,
    survey_id INT NOT NULL,
    respondent_email VARCHAR(200),
    respondent_name VARCHAR(200),
    ip_address VARCHAR(50),
    completion_time_seconds INT,
    is_complete BOOLEAN DEFAULT false,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
  )`, []);

  await query(`CREATE TABLE IF NOT EXISTS survey_answer (
    id SERIAL PRIMARY KEY,
    response_id INT REFERENCES survey_response(id) ON DELETE CASCADE,
    question_id INT REFERENCES survey_question(id),
    answer_text TEXT,
    answer_value JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`, []);

  // Seed NPS survey
  const npsCheck = await query(`SELECT id FROM survey WHERE title='Post-Purchase NPS Survey' LIMIT 1`, []);
  let npsSurveyId: number;

  if (npsCheck.rows.length === 0) {
    const npsSurvey = await query(
      `INSERT INTO survey (title, description, type, status) VALUES ($1,$2,$3,$4) RETURNING id`,
      ['Post-Purchase NPS Survey', 'Net Promoter Score survey sent after purchase', 'nps', 'active']
    );
    npsSurveyId = npsSurvey.rows[0].id;
  } else {
    npsSurveyId = npsCheck.rows[0].id;
  }

  const npsQs = await query(`SELECT COUNT(*) FROM survey_question WHERE survey_id=$1`, [npsSurveyId]);
  if (parseInt(npsQs.rows[0].count) === 0) {
    const npsQuestions = [
      { text: 'How likely are you to recommend us to a friend or colleague?', type: 'nps', options: '[]', sort: 1 },
      { text: 'What is the main reason for your score?', type: 'text', options: '[]', sort: 2 },
      { text: 'How would you rate our product quality?', type: 'rating', options: '[]', sort: 3 },
      { text: 'How was your customer support experience?', type: 'radio', options: JSON.stringify([{label:'Excellent',value:'5'},{label:'Good',value:'4'},{label:'Fair',value:'3'},{label:'Poor',value:'2'}]), sort: 4 },
      { text: 'Any additional feedback?', type: 'text', options: '[]', sort: 5 },
    ];
    for (const q of npsQuestions) {
      await query(
        `INSERT INTO survey_question (survey_id, question_text, question_type, options, sort_order) VALUES ($1,$2,$3,$4,$5)`,
        [npsSurveyId, q.text, q.type, q.options, q.sort]
      );
    }
  }

  // Seed CSAT survey
  const csatCheck = await query(`SELECT id FROM survey WHERE title='Customer Satisfaction Survey' LIMIT 1`, []);
  let csatSurveyId: number;

  if (csatCheck.rows.length === 0) {
    const csatSurvey = await query(
      `INSERT INTO survey (title, description, type, status) VALUES ($1,$2,$3,$4) RETURNING id`,
      ['Customer Satisfaction Survey', 'Comprehensive satisfaction assessment', 'feedback', 'active']
    );
    csatSurveyId = csatSurvey.rows[0].id;
  } else {
    csatSurveyId = csatCheck.rows[0].id;
  }

  const csatQs = await query(`SELECT COUNT(*) FROM survey_question WHERE survey_id=$1`, [csatSurveyId]);
  if (parseInt(csatQs.rows[0].count) === 0) {
    const csatQuestions = [
      { text: 'Overall, how satisfied are you with our service?', type: 'rating', options: '[]', sort: 1 },
      { text: 'How easy was it to use our platform?', type: 'rating', options: '[]', sort: 2 },
      { text: 'Did our product meet your expectations?', type: 'radio', options: JSON.stringify([{label:'Exceeded',value:'exceeded'},{label:'Met',value:'met'},{label:'Below',value:'below'}]), sort: 3 },
      { text: 'Which features do you use most?', type: 'checkbox', options: JSON.stringify([{label:'Dashboard',value:'dashboard'},{label:'Reports',value:'reports'},{label:'Campaigns',value:'campaigns'},{label:'Analytics',value:'analytics'}]), sort: 4 },
      { text: 'How often do you use our product?', type: 'radio', options: JSON.stringify([{label:'Daily',value:'daily'},{label:'Weekly',value:'weekly'},{label:'Monthly',value:'monthly'}]), sort: 5 },
      { text: 'What could we improve?', type: 'text', options: '[]', sort: 6 },
      { text: 'Would you purchase from us again?', type: 'radio', options: JSON.stringify([{label:'Definitely',value:'yes'},{label:'Maybe',value:'maybe'},{label:'No',value:'no'}]), sort: 7 },
    ];
    for (const q of csatQuestions) {
      await query(
        `INSERT INTO survey_question (survey_id, question_text, question_type, options, sort_order) VALUES ($1,$2,$3,$4,$5)`,
        [csatSurveyId, q.text, q.type, q.options, q.sort]
      );
    }
  }

  // Seed 10 demo responses
  const existingResponses = await query(`SELECT COUNT(*) FROM survey_response WHERE survey_id IN ($1,$2)`, [npsSurveyId, csatSurveyId]);
  if (parseInt(existingResponses.rows[0].count) < 5) {
    const respondents = [
      { email: 'alice@example.com', name: 'Alice Chen' },
      { email: 'bob@example.com', name: 'Bob Martinez' },
      { email: 'carol@example.com', name: 'Carol Smith' },
      { email: 'david@example.com', name: 'David Lee' },
      { email: 'emma@example.com', name: 'Emma Wilson' },
      { email: 'frank@example.com', name: 'Frank Brown' },
      { email: 'grace@example.com', name: 'Grace Kim' },
      { email: 'henry@example.com', name: 'Henry Davis' },
      { email: 'iris@example.com', name: 'Iris Johnson' },
      { email: 'jack@example.com', name: 'Jack Taylor' },
    ];
    for (let i = 0; i < respondents.length; i++) {
      const surveyId = i < 5 ? npsSurveyId : csatSurveyId;
      const r = respondents[i];
      await query(
        `INSERT INTO survey_response (survey_id, respondent_email, respondent_name, is_complete, completion_time_seconds, completed_at)
         VALUES ($1,$2,$3,true,$4,NOW()) ON CONFLICT DO NOTHING`,
        [surveyId, r.email, r.name, Math.floor(Math.random() * 300) + 60]
      );
    }
  }

  return Response.json({ ok: true, message: 'Survey seed complete', surveys: { nps: npsSurveyId, csat: csatSurveyId } });
}
