// GET /api/survey/nps-records — real invitation + response rows for the
// post-class-experience survey, for the admin NPS data table (the
// nps-summary endpoint only returns aggregates, not individual records).

import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const survey = await query<{ id: string }>(`SELECT id FROM survey WHERE slug = 'post-class-experience'`);
  if (!survey.rows.length) return Response.json({ invitations: [], responses: [] });
  const surveyId = survey.rows[0].id;

  const [invitations, responses] = await Promise.all([
    query<{ id: string; email: string; status: string; sent_at: string; completed_at: string | null }>(
      `SELECT id, email, status, sent_at, completed_at FROM survey_invitation
       WHERE survey_id = $1 ORDER BY sent_at DESC LIMIT 100`,
      [surveyId],
    ),
    query<{ id: string; respondent_email: string | null; status: string; submitted_at: string | null; nps_score: string | null; consent_given: boolean; quality_flags: string[]; quality_score: string | null }>(
      `SELECT r.id, r.respondent_email, r.status, r.submitted_at, r.consent_given, r.quality_flags, r.quality_score,
              (SELECT a.value_number FROM survey_answer a WHERE a.response_id = r.id AND a.question_type = 'nps') AS nps_score
       FROM survey_response r WHERE r.survey_id = $1 ORDER BY r.created_at DESC LIMIT 100`,
      [surveyId],
    ),
  ]);

  return Response.json({
    invitations: invitations.rows.map(r => ({
      id: r.id, email: r.email, status: r.status, sentAt: r.sent_at, completedAt: r.completed_at ?? undefined,
    })),
    responses: responses.rows.map(r => ({
      id: r.id, respondent: r.respondent_email ?? 'Anonymous', status: r.status,
      submittedAt: r.submitted_at ?? undefined, npsScore: r.nps_score !== null ? Number(r.nps_score) : undefined,
      consentGiven: r.consent_given, qualityFlags: r.quality_flags, qualityScore: r.quality_score !== null ? Number(r.quality_score) : undefined,
    })),
  });
}
