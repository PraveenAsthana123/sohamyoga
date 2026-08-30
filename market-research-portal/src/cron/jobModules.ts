// Dynamic job-module import map, keyed by module name (matches
// job_registry.module rows in the DB). Shared between runner.ts
// (scheduled execution) and the /api/jobs/run route (on-demand
// execution) so there is exactly one place that knows how to load a job.

export const JOB_MODULES: Record<string, () => Promise<{ run: (params?: any) => Promise<unknown> }>> = {
  ResearchAiDraftJob:     () => import('./jobs/ResearchAiDraftJob'),
  PricingCrossPortalJob:  () => import('./jobs/PricingCrossPortalJob'),
  ReviewsCrossPortalJob:  () => import('./jobs/ReviewsCrossPortalJob'),
  OperationsAlertSweepJob: () => import('./jobs/OperationsAlertSweepJob'),
  SelfHealJob: () => import('./jobs/SelfHealJob'),
};
