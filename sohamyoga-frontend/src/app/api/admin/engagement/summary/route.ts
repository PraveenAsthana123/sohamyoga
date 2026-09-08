import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Unified engagement ANALYTICS across survey/poll/form -- deliberately not a
// unified BUILDER (the three tables have genuinely different shapes:
// survey_response has respondent_id/email, poll_vote has only voter_user_id,
// form_submission is an anonymous JSONB blob). This is the honest, real
// slice: one read-only cross-cutting view, not a fabricated merged builder.
export async function GET(req: NextRequest) {
  const { denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const [surveys, polls, forms] = await Promise.all([
    query<{ total: string; last_activity: string | null }>(
      `SELECT count(*)::text AS total, max(created_at)::text AS last_activity FROM survey_response`,
    ),
    query<{ total: string; last_activity: string | null }>(
      `SELECT count(*)::text AS total, max(created_at)::text AS last_activity FROM poll_vote`,
    ),
    query<{ total: string; last_activity: string | null }>(
      `SELECT count(*)::text AS total, max(created_at)::text AS last_activity FROM form_submission`,
    ),
  ]);

  return Response.json({
    sources: [
      { key: 'survey', label: 'Survey Responses', total: Number(surveys.rows[0].total), lastActivity: surveys.rows[0].last_activity },
      { key: 'poll', label: 'Poll Votes', total: Number(polls.rows[0].total), lastActivity: polls.rows[0].last_activity },
      { key: 'form', label: 'Form Submissions', total: Number(forms.rows[0].total), lastActivity: forms.rows[0].last_activity },
    ],
  });
}
