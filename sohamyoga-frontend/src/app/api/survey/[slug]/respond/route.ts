// GET  /api/survey/:slug/respond — public, returns real question text so the
//      feedback page never hardcodes copy that could drift from the DB.
// POST /api/survey/:slug/respond — public submission endpoint. No auth: this
//      is how a customer who received an NPS invite (or landed anonymously,
//      since allow_anonymous=true) actually submits a response — the whole
//      reason this pipeline exists is that nothing could submit before.

import { NextRequest } from 'next/server';
import { databaseConfigured, query, transaction } from '@/lib/postgres';
import { detectQuality } from '@/domain/survey/QualityDetector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') || '0.0.0.0';
}

interface SurveyRow { id: string; status: string; confirmation_message: string | null; consent_required: boolean; consent_text: string }
interface QuestionRow { id: string; type: string; text: string; is_required: boolean; rating_min: number | null; rating_max: number | null }

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const survey = await query<SurveyRow>(`SELECT id, status, confirmation_message, consent_required, consent_text FROM survey WHERE slug = $1`, [params.slug]);
  if (!survey.rows.length) return Response.json({ error: 'Survey not found.' }, { status: 404 });
  if (survey.rows[0].status !== 'active') return Response.json({ error: 'This survey is not currently accepting responses.' }, { status: 410 });

  const questions = await query<QuestionRow>(
    `SELECT id, type, text, is_required, rating_min, rating_max FROM survey_question
     WHERE survey_id = $1 ORDER BY display_order`,
    [survey.rows[0].id],
  );

  return Response.json({
    confirmationMessage: survey.rows[0].confirmation_message,
    consentRequired: survey.rows[0].consent_required,
    consentText: survey.rows[0].consent_text,
    questions: questions.rows.map(q => ({
      id: q.id, type: q.type, text: q.text, required: q.is_required,
      ratingMin: q.rating_min ?? undefined, ratingMax: q.rating_max ?? undefined,
    })),
  });
}

interface RespondBody { token?: string; npsScore?: number; reasonText?: string; consent?: boolean }

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as RespondBody | null;
  if (!body || typeof body.npsScore !== 'number' || !Number.isInteger(body.npsScore)) {
    return Response.json({ error: 'npsScore is required and must be an integer.' }, { status: 400 });
  }
  if (body.reasonText && body.reasonText.length > 4000) {
    return Response.json({ error: 'reasonText must be 4000 characters or fewer.' }, { status: 400 });
  }

  const survey = await query<SurveyRow>(`SELECT id, status, confirmation_message, consent_required, consent_text FROM survey WHERE slug = $1`, [params.slug]);
  if (!survey.rows.length) return Response.json({ error: 'Survey not found.' }, { status: 404 });
  if (survey.rows[0].consent_required && !body.consent) {
    return Response.json({ error: 'Consent is required to submit this survey.' }, { status: 400 });
  }
  const surveyRow = survey.rows[0];
  if (surveyRow.status !== 'active') return Response.json({ error: 'This survey is not currently accepting responses.' }, { status: 410 });

  const questions = await query<QuestionRow>(
    `SELECT id, type, text, is_required, rating_min, rating_max FROM survey_question WHERE survey_id = $1`,
    [surveyRow.id],
  );
  const npsQuestion = questions.rows.find(q => q.type === 'nps');
  if (!npsQuestion) return Response.json({ error: 'Survey has no NPS question configured.' }, { status: 500 });
  const min = npsQuestion.rating_min ?? 0;
  const max = npsQuestion.rating_max ?? 10;
  if (body.npsScore < min || body.npsScore > max) {
    return Response.json({ error: `npsScore must be between ${min} and ${max}.` }, { status: 400 });
  }
  const textQuestion = questions.rows.find(q => q.type === 'long_text');

  let respondentEmail: string | null = null;
  let invitationId: string | null = null;
  if (body.token) {
    const invitation = await query<{ id: string; email: string; status: string }>(
      `SELECT id, email, status FROM survey_invitation WHERE survey_id = $1 AND token = $2`,
      [surveyRow.id, body.token],
    );
    if (!invitation.rows.length) return Response.json({ error: 'Invalid feedback link.' }, { status: 400 });
    if (invitation.rows[0].status === 'completed') {
      return Response.json({ error: 'This feedback link has already been used.' }, { status: 409 });
    }
    respondentEmail = invitation.rows[0].email;
    invitationId = invitation.rows[0].id;
  }

  const ip = clientIp(req);
  const recentIp = await query<{ count: string }>(
    `SELECT count(*)::text FROM survey_response
     WHERE survey_id = $1 AND ip_address = $2::inet AND submitted_at > now() - interval '10 minutes'`,
    [surveyRow.id, ip],
  );
  const quality = await detectQuality({
    npsScore: body.npsScore,
    reasonText: body.reasonText,
    recentSameIpCount: Number(recentIp.rows[0]?.count ?? 0),
  });

  const responseId = await transaction(async client => {
    const response = await client.query<{ id: string }>(
      `INSERT INTO survey_response (survey_id, respondent_email, status, completion_percent, submitted_at, ip_address, consent_given, quality_flags, quality_score)
       VALUES ($1,$2,'submitted',100,now(),$3::inet,$4,$5,$6) RETURNING id`,
      [surveyRow.id, respondentEmail, ip, Boolean(body.consent), quality.flags, quality.score],
    );
    const rid = response.rows[0].id;

    await client.query(
      `INSERT INTO survey_answer (response_id, question_id, question_type, value_number) VALUES ($1,$2,'nps',$3)`,
      [rid, npsQuestion.id, body.npsScore],
    );
    if (textQuestion && body.reasonText?.trim()) {
      await client.query(
        `INSERT INTO survey_answer (response_id, question_id, question_type, value_text) VALUES ($1,$2,'long_text',$3)`,
        [rid, textQuestion.id, body.reasonText.trim()],
      );
    }

    await client.query(
      `UPDATE survey SET response_count = response_count + 1, completion_count = completion_count + 1, updated_at = now() WHERE id = $1`,
      [surveyRow.id],
    );

    if (invitationId) {
      await client.query(`UPDATE survey_invitation SET status = 'completed', completed_at = now() WHERE id = $1`, [invitationId]);
    }

    return rid;
  });

  return Response.json({ ok: true, responseId, confirmationMessage: surveyRow.confirmation_message });
}
