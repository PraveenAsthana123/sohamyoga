/**
 * Dynamic job-module import map, keyed by class name (matches CronJobDef.module
 * in CronRegistry.ts). Shared between runner.ts (scheduled execution) and the
 * demo-hub "Run Now" API route (on-demand execution) so there is exactly one
 * place that knows how to load a job by name.
 */
export const JOB_MODULES: Record<string, () => Promise<{ run: () => Promise<void> }>> = {
  MarketingAutomationJob:     () => import('./jobs/MarketingAutomationJob'),
  NotificationDispatchJob:    () => import('./jobs/NotificationDispatchJob'),
  LeaderboardRefreshJob:      () => import('./jobs/LeaderboardRefreshJob'),
  NotificationRetryJob:       () => import('./jobs/NotificationRetryJob'),
  CampaignAdaptationJob:      () => import('./jobs/CampaignAdaptationJob'),
  AnalyticsAggregationJob:    () => import('./jobs/AnalyticsAggregationJob'),
  StreakUpdateJob:            () => import('./jobs/StreakUpdateJob'),
  WellnessScoringJob:         () => import('./jobs/WellnessScoringJob'),
  MilestoneCheckJob:          () => import('./jobs/MilestoneCheckJob'),
  BadgeAwardJob:              () => import('./jobs/BadgeAwardJob'),
  AiCoachJob:                 () => import('./jobs/AiCoachJob'),
  CampaignCopyDraftJob:       () => import('./jobs/CampaignCopyDraftJob'),
  ChurnPredictionJob:         () => import('./jobs/ChurnPredictionJob'),
  NewsletterDraftJob:         () => import('./jobs/NewsletterDraftJob'),
  CommunityDigestJob:         () => import('./jobs/CommunityDigestJob'),
  LeadNurturingJob:           () => import('./jobs/LeadNurturingJob'),
  SeoReportJob:               () => import('./jobs/SeoReportJob'),
  PostizProviderHealthJob:    () => import('./jobs/PostizProviderHealthJob'),
  FeatureGapAdvisorJob:       () => import('./jobs/FeatureGapAdvisorJob'),
  ModuleBoundaryQualityJob:   () => import('./jobs/ModuleBoundaryQualityJob'),
  AbandonedCartRecoveryJob:   () => import('./jobs/AbandonedCartRecoveryJob'),
  CampaignHealthAuditJob:     () => import('./jobs/CampaignHealthAuditJob'),
  NpsInvitationJob:           () => import('./jobs/NpsInvitationJob'),
  NpsCalculationJob:          () => import('./jobs/NpsCalculationJob'),
  SocialContentIdeaJob:       () => import('./jobs/SocialContentIdeaJob'),
  VoiceOfCustomerJob:         () => import('./jobs/VoiceOfCustomerJob'),
};
