import { query } from '@/lib/postgres';

export interface SamplingStatus {
  projectId: string;
  surveyId: string | null;
  surveyTitle: string | null;
  targetSampleSize: number | null;
  invitationCounts: Record<string, number>;
  totalInvited: number;
  completedResponses: number;
  progressPercent: number | null;
}

const INVITATION_STATUSES = ['sent', 'opened', 'started', 'completed', 'bounced'];

/** Real "Sampling Management" -- links a research_project to the survey it's
 * actually fielding (survey_invitation is the real recruitment mechanism,
 * already driven by the hourly NpsInvitationJob) and reports the real
 * recruitment funnel, rather than a fabricated quota-tracking widget. */
export async function getSamplingStatus(projectId: string): Promise<SamplingStatus> {
  const project = await query<{ survey_id: string | null; target_sample_size: number | null }>(
    'SELECT survey_id, target_sample_size FROM research_project WHERE id = $1',
    [projectId]
  );
  if (!project.rowCount) throw new Error('Research project not found.');
  const { survey_id: surveyId, target_sample_size: targetSampleSize } = project.rows[0];

  const invitationCounts: Record<string, number> = Object.fromEntries(INVITATION_STATUSES.map((s) => [s, 0]));
  let surveyTitle: string | null = null;
  let totalInvited = 0;
  let completedResponses = 0;

  if (surveyId) {
    const surveyRow = await query<{ title: string }>('SELECT title FROM survey WHERE id = $1', [surveyId]);
    surveyTitle = surveyRow.rows[0]?.title ?? null;

    const counts = await query<{ status: string; n: string }>(
      'SELECT status, count(*)::text AS n FROM survey_invitation WHERE survey_id = $1 GROUP BY status',
      [surveyId]
    );
    for (const row of counts.rows) invitationCounts[row.status] = Number(row.n);
    totalInvited = Object.values(invitationCounts).reduce((a, b) => a + b, 0);
    completedResponses = invitationCounts.completed ?? 0;
  }

  const progressPercent = targetSampleSize ? Math.round((completedResponses / targetSampleSize) * 100) : null;

  return { projectId, surveyId, surveyTitle, targetSampleSize, invitationCounts, totalInvited, completedResponses, progressPercent };
}

export async function linkProjectSurvey(projectId: string, surveyId: string | null, targetSampleSize: number | null): Promise<void> {
  await query(
    'UPDATE research_project SET survey_id = $2, target_sample_size = $3, updated_at = now() WHERE id = $1',
    [projectId, surveyId, targetSampleSize]
  );
}
