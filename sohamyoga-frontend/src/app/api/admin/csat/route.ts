import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureSchema(pool: ReturnType<typeof getPool>) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS csat_surveys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      trigger_event TEXT DEFAULT 'post_purchase',
      question_text TEXT DEFAULT 'How satisfied were you with your experience?',
      scale INT DEFAULT 5,
      follow_up_question TEXT,
      status TEXT DEFAULT 'active',
      total_responses INT DEFAULT 0,
      avg_score NUMERIC(4,2),
      distribution_json JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS csat_responses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      survey_id UUID REFERENCES csat_surveys(id) ON DELETE CASCADE,
      customer_email TEXT,
      customer_name TEXT,
      score INT NOT NULL,
      follow_up_text TEXT,
      sentiment TEXT,
      entities_json JSONB DEFAULT '[]',
      complaint_category TEXT,
      complaint_severity TEXT,
      is_escalated BOOLEAN DEFAULT false,
      escalation_reason TEXT,
      escalation_level TEXT,
      legal_flag BOOLEAN DEFAULT false,
      legal_notes TEXT,
      responded BOOLEAN DEFAULT false,
      response_text TEXT,
      source TEXT DEFAULT 'email',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS complaint_escalations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      response_id UUID REFERENCES csat_responses(id),
      escalation_type TEXT,
      reason TEXT,
      assigned_to TEXT,
      status TEXT DEFAULT 'open',
      resolution_text TEXT,
      resolved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

async function seedIfEmpty(pool: ReturnType<typeof getPool>) {
  const { rows } = await pool.query('SELECT COUNT(*) AS cnt FROM csat_surveys');
  if (parseInt(rows[0].cnt) > 0) return;

  const surveys = await pool.query(`
    INSERT INTO csat_surveys (name, trigger_event, question_text, scale, follow_up_question, status)
    VALUES
      ('Post-Purchase Satisfaction', 'post_purchase', 'How satisfied were you with your purchase experience?', 5, 'What could we improve?', 'active'),
      ('Class Experience Survey', 'post_service', 'How was your yoga class experience today?', 5, 'What did you enjoy most or least?', 'active'),
      ('Support Ticket Follow-up', 'post_support', 'How satisfied were you with our customer support?', 10, 'Any additional feedback for our team?', 'active')
    RETURNING id, scale
  `);

  const respondentData = [
    { name: 'Alice Chen', email: 'alice@example.com', score: 5, text: 'Amazing experience! The instructor was fantastic and the studio was clean.', sentiment: 'positive', source: 'email' },
    { name: 'Bob Martin', email: 'bob@example.com', score: 2, text: 'Very disappointed. The product arrived damaged and support took 5 days to respond.', sentiment: 'negative', source: 'web' },
    { name: 'Carol Singh', email: 'carol@example.com', score: 4, text: 'Great class overall. The music was a bit loud but the instructor was excellent.', sentiment: 'positive', source: 'email' },
    { name: 'David Lee', email: 'david@example.com', score: 1, text: 'Worst experience ever. I want a full refund. This is unacceptable and I may contact a lawyer.', sentiment: 'negative', source: 'web' },
    { name: 'Emma Wilson', email: 'emma@example.com', score: 5, text: 'Absolutely love this studio! Sarah is the best instructor I have ever had.', sentiment: 'positive', source: 'in_app' },
    { name: 'Frank Kumar', email: 'frank@example.com', score: 3, text: 'Decent experience. Nothing special but nothing terrible either. The mat was worn out.', sentiment: 'neutral', source: 'sms' },
    { name: 'Grace Patel', email: 'grace@example.com', score: 4, text: 'Really enjoyed the session. Would appreciate more beginner-friendly options.', sentiment: 'positive', source: 'email' },
    { name: 'Henry Brown', email: 'henry@example.com', score: 2, text: 'Billing issue was never resolved after 3 weeks. Very frustrated with the accounting team.', sentiment: 'negative', source: 'web' },
    { name: 'Isabella Torres', email: 'isabella@example.com', score: 5, text: 'Perfect in every way. The Mumbai location is my favorite.', sentiment: 'positive', source: 'qr' },
    { name: 'James White', email: 'james@example.com', score: 1, text: 'Charged twice for the same month. This is fraud. I am disputing with my credit card company.', sentiment: 'negative', source: 'email' },
  ];

  const responseIds: string[] = [];
  for (const [i, survey] of surveys.rows.entries()) {
    // Assign roughly 6-7 responses to first survey, fewer to others
    const slice = i === 0 ? respondentData.slice(0, 7) : i === 1 ? respondentData.slice(7, 10) : respondentData.slice(5, 7);
    for (const r of slice) {
      const maxScore = survey.scale as number;
      const adjustedScore = Math.min(r.score, maxScore);
      const severity = adjustedScore === 1 ? 'critical' : adjustedScore === 2 ? 'high' : adjustedScore === 3 ? 'medium' : 'low';
      const category = r.text.toLowerCase().includes('billing') || r.text.toLowerCase().includes('charged') || r.text.toLowerCase().includes('refund') ? 'billing'
        : r.text.toLowerCase().includes('product') || r.text.toLowerCase().includes('damaged') ? 'quality'
        : r.text.toLowerCase().includes('support') ? 'service'
        : adjustedScore <= 2 ? 'service' : 'other';
      const { rows: rr } = await pool.query(`
        INSERT INTO csat_responses (survey_id, customer_email, customer_name, score, follow_up_text, sentiment, complaint_category, complaint_severity, source)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id
      `, [survey.id, r.email, r.name, adjustedScore, r.text, r.sentiment, category, severity, r.source]);
      responseIds.push(rr[0].id);
    }
    // Update survey stats
    await pool.query(`
      UPDATE csat_surveys SET
        total_responses = (SELECT COUNT(*) FROM csat_responses WHERE survey_id = $1),
        avg_score = (SELECT AVG(score) FROM csat_responses WHERE survey_id = $1),
        distribution_json = (
          SELECT jsonb_object_agg(score::text, cnt) FROM (
            SELECT score, COUNT(*) AS cnt FROM csat_responses WHERE survey_id = $1 GROUP BY score
          ) t
        )
      WHERE id = $1
    `, [survey.id]);
  }

  // Seed escalations for critical/high responses
  const criticalResponses = await pool.query(
    `SELECT id, complaint_severity, customer_name FROM csat_responses WHERE complaint_severity IN ('critical','high') LIMIT 4`
  );
  const escalationTypes = ['legal', 'manager', 'executive', 'refund'];
  for (const [i, resp] of criticalResponses.rows.entries()) {
    const etype = escalationTypes[i % escalationTypes.length];
    await pool.query(`
      INSERT INTO complaint_escalations (response_id, escalation_type, reason, assigned_to, status)
      VALUES ($1,$2,$3,$4,$5)
    `, [resp.id, etype, `Auto-escalated due to ${resp.complaint_severity} complaint severity`, i === 0 ? 'legal@sohamyoga.com' : 'manager@sohamyoga.com', i === 2 ? 'resolved' : 'open']);
    if (etype === 'legal') {
      await pool.query(`UPDATE csat_responses SET is_escalated=true, legal_flag=true, escalation_level=$1 WHERE id=$2`, [etype, resp.id]);
    } else {
      await pool.query(`UPDATE csat_responses SET is_escalated=true, escalation_level=$1 WHERE id=$2`, [etype, resp.id]);
    }
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  try {
    await ensureSchema(pool);
    await seedIfEmpty(pool);
    const [surveys, recentResponses, escalationCount, legalCount] = await Promise.all([
      pool.query(`
        SELECT s.*,
          (SELECT COUNT(*) FROM csat_responses r WHERE r.survey_id = s.id AND r.score <= 2) AS detractor_count,
          (SELECT COUNT(*) FROM csat_responses r WHERE r.survey_id = s.id AND r.score >= 4) AS promoter_count
        FROM csat_surveys s ORDER BY s.created_at DESC
      `),
      pool.query(`
        SELECT r.*, s.name AS survey_name
        FROM csat_responses r
        JOIN csat_surveys s ON s.id = r.survey_id
        ORDER BY r.created_at DESC LIMIT 20
      `),
      pool.query(`SELECT COUNT(*) AS cnt FROM complaint_escalations WHERE status='open'`),
      pool.query(`SELECT COUNT(*) AS cnt FROM csat_responses WHERE legal_flag=true`),
    ]);
    const overallAvg = surveys.rows.reduce((sum: number, s: Record<string, string | number>) => sum + (parseFloat(s.avg_score as string) || 0), 0) / (surveys.rows.length || 1);
    return Response.json({
      surveys: surveys.rows,
      recentResponses: recentResponses.rows,
      openEscalations: parseInt(escalationCount.rows[0].cnt),
      legalFlags: parseInt(legalCount.rows[0].cnt),
      overallAvgScore: overallAvg.toFixed(2),
    });
  } catch (err) {
    console.error('CSAT GET error:', err);
    return Response.json({ error: 'Failed to load CSAT data' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  try {
    await ensureSchema(pool);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request body' }, { status: 400 });
    const { name, trigger_event, question_text, scale, follow_up_question } = body as Record<string, unknown>;
    if (!name || typeof name !== 'string' || !name.trim()) return Response.json({ error: 'Survey name is required' }, { status: 400 });
    const validTriggers = ['post_purchase', 'post_service', 'post_event', 'post_support', 'periodic'];
    const validScales = [5, 10];
    const trig = typeof trigger_event === 'string' && validTriggers.includes(trigger_event) ? trigger_event : 'post_purchase';
    const sc = typeof scale === 'number' && validScales.includes(scale) ? scale : 5;
    const { rows } = await pool.query(`
      INSERT INTO csat_surveys (name, trigger_event, question_text, scale, follow_up_question)
      VALUES ($1,$2,$3,$4,$5) RETURNING *
    `, [
      name.trim(),
      trig,
      typeof question_text === 'string' && question_text.trim() ? question_text.trim() : 'How satisfied were you with your experience?',
      sc,
      typeof follow_up_question === 'string' && follow_up_question.trim() ? follow_up_question.trim() : null,
    ]);
    return Response.json({ survey: rows[0] }, { status: 201 });
  } catch (err) {
    console.error('CSAT POST error:', err);
    return Response.json({ error: 'Failed to create survey' }, { status: 500 });
  }
}
