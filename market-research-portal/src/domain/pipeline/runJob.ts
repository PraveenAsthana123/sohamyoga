// Shared job-execution helper — records a real job_run row (status,
// started_at/completed_at/duration_ms), runs the job module for real, and
// returns its result. Used by both the on-demand /api/jobs/run route and
// the "Run Pipeline" flow that kicks off ResearchAiDraftJob per phase.

import { JOB_MODULES } from '../../cron/jobModules';
import { startJobRun, finishJobRun } from './JobRunTracker';
import { query } from '../../lib/postgres';

/**
 * job_run.job_name has a FK into job_registry(name) — job_registry rows
 * are keyed by kebab-case name (e.g. "research-ai-draft"), while callers
 * pass the module class name (e.g. "ResearchAiDraftJob", matching
 * JOB_MODULES / job_registry.module). Resolve module -> registry name so
 * the FK is always satisfied.
 */
async function resolveRegistryName(moduleName: string): Promise<string | null> {
  const result = await query<{ name: string }>(`SELECT name FROM job_registry WHERE module = $1`, [moduleName]);
  return result.rowCount ? result.rows[0].name : null;
}

export async function runJob(moduleName: string, params: Record<string, unknown> = {}): Promise<{ jobRunId: string; status: 'succeeded' | 'failed'; result?: unknown; error?: string }> {
  const studyId = (params.studyId as string) ?? null;
  const phaseId = (params.phaseId as string) ?? null;

  const registryName = await resolveRegistryName(moduleName);
  if (!registryName) {
    throw new Error(`No job_registry row found for module "${moduleName}" — refusing to run an unregistered job.`);
  }
  const jobRunId = await startJobRun(registryName, studyId, phaseId);

  const mod = JOB_MODULES[moduleName];
  if (!mod) {
    await finishJobRun(jobRunId, 'failed', '', `Unknown job module: ${moduleName}`);
    return { jobRunId, status: 'failed', error: `Unknown job module: ${moduleName}` };
  }

  try {
    const loaded = await mod();
    const result = await loaded.run(params);
    await finishJobRun(jobRunId, 'succeeded', JSON.stringify(result).slice(0, 2000));
    return { jobRunId, status: 'succeeded', result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finishJobRun(jobRunId, 'failed', '', message);
    return { jobRunId, status: 'failed', error: message };
  }
}
