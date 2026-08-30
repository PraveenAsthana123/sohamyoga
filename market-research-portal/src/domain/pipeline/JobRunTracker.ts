// Real job-run tracking against job_run — ported structure from
// sohamyoga-frontend's operation_run pattern, scoped to this app's own
// job_registry/job_run tables and parameterized by an optional study_id
// since jobs here run per-study, not just globally.

import { query } from '../../lib/postgres';

export async function startJobRun(jobName: string, studyId: string | null, phaseId: string | null): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO job_run (job_name, study_id, phase_id, status, started_at) VALUES ($1, $2, $3, 'running', now()) RETURNING id`,
    [jobName, studyId, phaseId],
  );
  return result.rows[0].id;
}

export async function finishJobRun(jobRunId: string, status: 'succeeded' | 'failed', resultSummary: string, errorMessage: string | null = null): Promise<void> {
  await query(
    `UPDATE job_run
     SET status = $1, completed_at = now(), duration_ms = EXTRACT(EPOCH FROM (now() - started_at)) * 1000, result_summary = $2, error_message = $3
     WHERE id = $4`,
    [status, resultSummary, errorMessage, jobRunId],
  );
}

/** moduleName is the JOB_MODULES/job_registry.module key (e.g. "ResearchAiDraftJob") — resolved to job_registry.name internally so callers don't need to know the kebab-case registry name. */
export async function getLastJobRun(moduleName: string, studyId?: string) {
  const result = studyId
    ? await query(
        `SELECT jr.* FROM job_run jr JOIN job_registry reg ON reg.name = jr.job_name WHERE reg.module = $1 AND jr.study_id = $2 ORDER BY jr.created_at DESC LIMIT 1`,
        [moduleName, studyId],
      )
    : await query(
        `SELECT jr.* FROM job_run jr JOIN job_registry reg ON reg.name = jr.job_name WHERE reg.module = $1 ORDER BY jr.created_at DESC LIMIT 1`,
        [moduleName],
      );
  return result.rowCount ? result.rows[0] : null;
}

export async function listJobRegistry() {
  const result = await query(`SELECT * FROM job_registry ORDER BY name`);
  return result.rows;
}
