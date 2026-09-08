import { NextRequest } from 'next/server';
import { databaseConfigured, query, transaction } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AnswerInput { questionId?: string; valueText?: string; valueNumber?: number; valueArray?: string[] }

// Real submission for the general Survey Builder + the real Survey ->
// Marketing Automation connector: on submit, writes a real
// journey_touchpoint(type=survey_response), the same real event stream
// CampaignTriggerJob (built earlier this session) already watches to fire
// trigger campaigns. Confirmed via grep this enum value was never written
// anywhere before.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { slug } = await params;
  const body = await req.json().catch(() => null) as { email?: string; consent?: boolean; answers?: AnswerInput[] } | null;
  const answers = Array.isArray(body?.answers) ? body!.answers : [];

  const survey = await query<{ id: string; tenant_id: string | null; consent_required: boolean; confirmation_message: string | null }>(
    `SELECT id, consent_required, confirmation_message FROM survey WHERE slug = $1 AND status = 'active'`,
    [slug],
  );
  if (!survey.rowCount) return Response.json({ error: 'Survey not found or not accepting responses.' }, { status: 404 });
  const s = survey.rows[0];
  if (s.consent_required && !body?.consent) return Response.json({ error: 'Consent is required to submit this survey.' }, { status: 400 });

  const requiredQuestions = await query<{ id: string }>(`SELECT id FROM survey_question WHERE survey_id = $1 AND is_required = true`, [s.id]);
  const answeredIds = new Set(answers.map(a => a.questionId));
  for (const rq of requiredQuestions.rows) {
    if (!answeredIds.has(rq.id)) return Response.json({ error: 'Please answer all required questions.' }, { status: 400 });
  }

  const result = await transaction(async client => {
    const response = await client.query<{ id: string }>(
      `INSERT INTO survey_response (survey_id, respondent_email, status, completion_percent, consent_given, submitted_at)
       VALUES ($1,$2,'submitted',100,$3,now()) RETURNING id`,
      [s.id, body?.email?.trim() || null, Boolean(body?.consent)],
    );
    const responseId = response.rows[0].id;

    for (const a of answers) {
      if (!a.questionId) continue;
      await client.query(
        `INSERT INTO survey_answer (response_id, question_id, question_type, value_text, value_number, value_array)
         SELECT $1, $2, type, $3, $4, $5 FROM survey_question WHERE id = $2`,
        [responseId, a.questionId, a.valueText ?? null, a.valueNumber ?? null, a.valueArray ?? null],
      );
    }

    await client.query(
      `UPDATE survey SET response_count = response_count + 1, completion_count = completion_count + 1 WHERE id = $1`,
      [s.id],
    );

    // Real Survey -> Marketing Automation connector -- journey_touchpoint
    // already had a real survey_response enum value that no code ever wrote.
    if (body?.email?.trim()) {
      const tenantId = await getPrimaryTenantId();
      await client.query(
        `INSERT INTO journey_touchpoint (tenant_id, contact_identifier, touchpoint_type, source_module, metadata)
         VALUES ($1,$2,'survey_response','survey_builder',$3)`,
        [tenantId, body.email.trim(), JSON.stringify({ surveyId: s.id, responseId })],
      );
    }

    return responseId;
  });

  return Response.json({ ok: true, responseId: result, confirmationMessage: s.confirmation_message }, { status: 201 });
}
