// Cron Job Registry — all autonomous background jobs.
// Every job uses local Ollama — zero cloud tokens after setup.
// Schedules use standard cron syntax (UTC).

export interface CronJobDef {
  name:        string;
  schedule:    string;   // cron expression
  description: string;
  module:      string;   // relative import path from jobs/
  enabled:     boolean;
  timeoutMs:   number;
}

export const CRON_JOBS: CronJobDef[] = [
  {
    name:        'marketing-automation',
    schedule:    '*/2 * * * *',
    description: 'Claim tenant campaign briefs and generate approval-ready copy, banner prompts, and video scripts with local Ollama',
    module:      'MarketingAutomationJob',
    enabled:     true,
    timeoutMs:   240_000,
  },
  // ── Every 5 minutes ──────────────────────────────────────────────────────
  {
    name:        'notification-dispatch',
    schedule:    '*/5 * * * *',
    description: 'Process due notifications from queue — email, SMS, push, in-app via Novu/Listmonk/ntfy',
    module:      'NotificationDispatchJob',
    enabled:     true,
    timeoutMs:   60_000,
  },
  {
    name:        'postiz-social-auto-publish',
    schedule:    '*/5 * * * *',
    description: 'Publish approved due Facebook and LinkedIn variants through connected Postiz integrations; complete the master draft only after all variants finish',
    module:      'PostizSocialAutoPublishJob',
    enabled:     true,
    timeoutMs:   60_000,
  },
  {
    name:        'first-wave-dispatch',
    schedule:    '*/5 * * * *',
    description: 'Publish approved due Telegram/Discord/Mastodon/Bluesky variants via the direct-API first-wave adapters (no Postiz dependency); honestly blocked per-account until real credentials are connected',
    module:      'FirstWaveDispatchJob',
    enabled:     true,
    timeoutMs:   60_000,
  },

  // ── Every 10 minutes ─────────────────────────────────────────────────────
  {
    name:        'leaderboard-refresh',
    schedule:    '*/10 * * * *',
    description: 'Recalculate gamification leaderboard rankings from points_ledger',
    module:      'LeaderboardRefreshJob',
    enabled:     true,
    timeoutMs:   30_000,
  },

  // ── Every 30 minutes ─────────────────────────────────────────────────────
  {
    name:        'abandoned-cart-recovery',
    schedule:    '*/30 * * * *',
    description: 'Draft a personalized recovery message (Ollama) for carts stalled in draft/pending 2+ hours, grounded in the actual cart items — staff sends manually',
    module:      'AbandonedCartRecoveryJob',
    enabled:     true,
    timeoutMs:   120_000,
  },

  // ── Hourly ────────────────────────────────────────────────────────────────
  {
    name:        'notification-retry',
    schedule:    '0 * * * *',
    description: 'Retry failed notifications (retryCount < MAX_NOTIFICATION_RETRIES=3)',
    module:      'NotificationRetryJob',
    enabled:     true,
    timeoutMs:   60_000,
  },
  {
    name:        'complaint-alert',
    schedule:    '5 * * * *',
    description: 'Alert staff (notification_queue) on unalerted negative-sentiment entries in sentiment_log — real-time complement to the weekly Voice of Customer digest',
    module:      'ComplaintAlertJob',
    enabled:     true,
    timeoutMs:   30_000,
  },
  {
    name:        'dunning-management',
    schedule:    '20 8 * * *',
    description: 'Send real dunning reminders (notification_queue) to subscriptions in grace_period at 3d/1d/final-day remaining, idempotent per subscription per bucket -- previously no reminder was ever sent during grace_period',
    module:      'DunningManagementJob',
    enabled:     true,
    timeoutMs:   60_000,
  },
  {
    name:        'campaign-trigger',
    schedule:    '*/15 * * * *',
    description: 'Fires real lifecycle_campaign rows of campaign_type=trigger against new journey_touchpoint events matching trigger_event -- previously trigger was a selectable label with zero execution behind it. Idempotent via lifecycle_campaign_trigger_log.',
    module:      'CampaignTriggerJob',
    enabled:     true,
    timeoutMs:   60_000,
  },
  {
    name:        'crisis-detection',
    schedule:    '10 6 * * *',
    description: 'Negative Virality / Crisis detection -- flags today as a crisis only when negative sentiment_log volume is a real z-score outlier (>=2 stddev) against its own 14-day baseline, mirroring ViralDetectionJob\'s methodology. Queues one real alert per crisis day.',
    module:      'CrisisDetectionJob',
    enabled:     true,
    timeoutMs:   30_000,
  },
  {
    name:        'campaign-adaptation',
    schedule:    '15 * * * *',
    description: 'AI-adapt pending campaign content variants for each platform using Ollama (strong model)',
    module:      'CampaignAdaptationJob',
    enabled:     true,
    timeoutMs:   300_000,
  },
  {
    name:        'wellness-score-compute',
    schedule:    '20 4 * * *',
    description: 'Computes a real wellness_score row (mood_score/energy_score/composite) for any student-day that has a practice_journal entry but no score yet -- deterministic, no Ollama, only from data the app actually collects (mood_after, energy_level); sleep/activity/mindfulness stay null since nothing measures them',
    module:      'WellnessScoreComputeJob',
    enabled:     true,
    timeoutMs:   60_000,
  },
  {
    name:        'campaign-health-audit',
    schedule:    '45 * * * *',
    description: 'Audit active ad campaigns for structural config problems (no ad groups/targeting, expired-but-active, bid exceeding daily budget) — Ollama drafts the explanation from given facts only, no performance data is fabricated',
    module:      'CampaignHealthAuditJob',
    enabled:     true,
    timeoutMs:   180_000,
  },
  {
    name:        'provisioning-task-staleness',
    schedule:    '30 * * * *',
    description: 'Assigns a real due date to open provisioning_human_task rows that lack one, and raises/resolves provisioning_task_alert rows for tasks past due — closes the gap where 172 real human tasks had no SLA or alerting at all',
    module:      'ProvisioningTaskStalenessJob',
    enabled:     true,
    timeoutMs:   60_000,
  },
  {
    name:        'brand-profile-draft',
    schedule:    '0 5 * * *',
    description: 'Drafts the single tenant-level social_brand_profile row (tagline, 3 bio lengths, description, keywords, hashtags) via Ollama, grounded only in verified tenant facts — lands in draft status pending human approval; a table that had zero writers anywhere before this',
    module:      'BrandProfileDraftJob',
    enabled:     true,
    timeoutMs:   120_000,
  },
  {
    name:        'platform-bio-draft',
    schedule:    '15 5 * * *',
    description: 'For each of the 35 registered platforms, derives (via Ollama) a platform-fitted bio from the one approved social_brand_profile — never drafts platforms independently, so brand voice stays consistent; skips entirely if the master profile is not yet approved',
    module:      'PlatformBioDraftJob',
    enabled:     true,
    timeoutMs:   300_000,
  },
  {
    name:        'nps-invitation',
    schedule:    '20 * * * *',
    description: 'Invite students to the post-class-experience NPS survey once a checked-in class has genuinely ended (computed from session end time, not a status column nothing sets)',
    module:      'NpsInvitationJob',
    enabled:     true,
    timeoutMs:   60_000,
  },
  {
    name:        'nps-calculation',
    schedule:    '50 * * * *',
    description: 'Compute real NPS scores (promoters/passives/detractors) from submitted survey_answer rows; classify free-text reasons with Ollama sentiment',
    module:      'NpsCalculationJob',
    enabled:     true,
    timeoutMs:   180_000,
  },
  {
    name:        'csat-calculation',
    schedule:    '55 * * * *',
    description: 'Compute real CSAT (top-2-box) scores from submitted survey_answer rows on feedback-type surveys with a rating_scale question -- no AI, deterministic. Reuses the existing real survey/survey_analytics infrastructure, mirrors NpsCalculationJob.',
    module:      'CsatCalculationJob',
    enabled:     true,
    timeoutMs:   60_000,
  },
  {
    name:        'ces-calculation',
    schedule:    '57 * * * *',
    description: 'Compute real CES (Customer Effort Score, top-2-box) from submitted survey_answer rows on ces-type surveys with a rating_scale question -- no AI, deterministic. Mirrors CsatCalculationJob exactly, needed its own survey type (migration 151) to stay distinguishable from CSAT.',
    module:      'CesCalculationJob',
    enabled:     true,
    timeoutMs:   60_000,
  },
  {
    name:        'review-request',
    schedule:    '0 9 * * *',
    description: 'Real Review Request Campaign: finds checked_in bookings for completed classes with no review yet, queues a real email with a link to the real customer-facing review page (src/app/reviews/submit/[bookingId]) -- idempotent per booking, no AI.',
    module:      'ReviewRequestJob',
    enabled:     true,
    timeoutMs:   60_000,
  },
  {
    name:        'opportunity-scoring',
    schedule:    '15 3 * * *',
    description: 'Advisory-only AI scoring (0-100 urgency x value x momentum) for open CRM opportunities via Ollama, mirroring BacklogPrioritizationJob\'s ai_priority pattern -- writes opportunity.ai_score/ai_note only, never touches stage or probability_pct.',
    module:      'OpportunityScoringJob',
    enabled:     true,
    timeoutMs:   180_000,
  },
  {
    name:        'social-content-idea',
    schedule:    '5 * * * *',
    description: 'Auto-enqueue an hourly campaign brief (rotating honest, non-fabricated angles) for every tenant with a configured business profile and at least one enabled channel — MarketingAutomationJob then generates real copy/banner-prompt content into the review queue; never publishes',
    module:      'SocialContentIdeaJob',
    enabled:     true,
    timeoutMs:   30_000,
  },

  // ── Every 15 minutes ─────────────────────────────────────────────────────
  {
    name:        'appointment-reminder',
    schedule:    '*/15 * * * *',
    description: 'Real Appointment Reminder Engine -- queues a real in_app notification for confirmed bookings whose class starts within the customer\'s own reminder_minutes_before window (set at onboarding, previously never acted on). No AI, idempotent per booking.',
    module:      'AppointmentReminderJob',
    enabled:     true,
    timeoutMs:   60_000,
  },
  {
    name:        'local-folder-scan',
    schedule:    '*/15 * * * *',
    description: 'Scan WATCHED_FOLDER_PATH for new/changed .txt/.md files; honest no-op until the env var is configured',
    module:      'LocalFolderScanJob',
    enabled:     true,
    timeoutMs:   60_000,
  },

  // ── Every 30 minutes ─────────────────────────────────────────────────────
  {
    name:        'connector-token-refresh',
    schedule:    '*/30 * * * *',
    description: 'Proactively refresh OAuth access tokens nearing expiry for any active connector credential; honest no-op until a real connection exists',
    module:      'ConnectorTokenRefreshJob',
    enabled:     true,
    timeoutMs:   60_000,
  },
  {
    name:        'cta-health-check',
    schedule:    '0 */6 * * *',
    description: 'Re-check every non-archived CTA\'s destination URL; broken CTAs fall back to their fallback_url on the next real click',
    module:      'CtaHealthCheckJob',
    enabled:     true,
    timeoutMs:   120_000,
  },
  {
    name:        'health-snapshot',
    schedule:    '7 * * * *',
    description: 'Capture one real health_snapshot row per tenant (revenue/leads/bookings last 24h + DB reachability/latency) so Business -> Technical Correlation has real history to compute against',
    module:      'HealthSnapshotJob',
    enabled:     true,
    timeoutMs:   60_000,
  },
  {
    name:        'google-drive-scan',
    schedule:    '15,45 * * * *',
    description: 'Scan connected Google Drive for new/changed Docs & Sheets; honest no-op until Google Drive is connected',
    module:      'GoogleDriveScanJob',
    enabled:     true,
    timeoutMs:   120_000,
  },
  {
    name:        'slack-scan',
    schedule:    '5,35 * * * *',
    description: 'Scan connected Slack channels for new/changed message history; honest no-op until Slack is connected',
    module:      'SlackScanJob',
    enabled:     true,
    timeoutMs:   120_000,
  },

  // ── Every 6 hours ────────────────────────────────────────────────────────
  {
    name:        'ingestion-source-refresh',
    schedule:    '0 */6 * * *',
    description: 'Re-check every registered chatgpt_shared_snapshot source for content changes, recording a new source_version when the snapshot has grown or changed',
    module:      'IngestionSourceRefreshJob',
    enabled:     true,
    timeoutMs:   120_000,
  },

  // ── Daily 01:00 UTC ───────────────────────────────────────────────────────
  {
    name:        'analytics-aggregation',
    schedule:    '0 1 * * *',
    description: 'Aggregate daily campaign analytics: impressions, clicks, leads, bookings, spend per platform',
    module:      'AnalyticsAggregationJob',
    enabled:     true,
    timeoutMs:   120_000,
  },

  // ── Daily 02:00 UTC ───────────────────────────────────────────────────────
  {
    name:        'streak-update',
    schedule:    '0 2 * * *',
    description: 'Update practice streaks for all students — reset missed days, award streak milestones',
    module:      'StreakUpdateJob',
    enabled:     true,
    timeoutMs:   120_000,
  },

  // ── Daily 03:00 UTC ───────────────────────────────────────────────────────
  {
    name:        'wellness-scoring',
    schedule:    '0 3 * * *',
    description: 'Calculate daily composite wellness score (0-100) from journal entries using Ollama fast model',
    module:      'WellnessScoringJob',
    enabled:     true,
    timeoutMs:   180_000,
  },

  // ── Daily 04:00 UTC ───────────────────────────────────────────────────────
  {
    name:        'milestone-check',
    schedule:    '0 4 * * *',
    description: 'Scan all students for milestone thresholds — award XP, badge, coupon when earned',
    module:      'MilestoneCheckJob',
    enabled:     true,
    timeoutMs:   180_000,
  },

  // ── Daily 04:30 UTC ───────────────────────────────────────────────────────
  {
    name:        'badge-award',
    schedule:    '30 4 * * *',
    description: 'Award badges based on milestone completions and streak achievements',
    module:      'BadgeAwardJob',
    enabled:     true,
    timeoutMs:   60_000,
  },

  // ── Daily 05:00 UTC ───────────────────────────────────────────────────────
  {
    name:        'ai-coach',
    schedule:    '0 5 * * *',
    description: 'Generate personalized class/pose recommendations per student using Ollama strong model',
    module:      'AiCoachJob',
    enabled:     true,
    timeoutMs:   600_000,
  },

  // ── Daily 06:00 UTC ───────────────────────────────────────────────────────
  {
    name:        'campaign-copy-draft',
    schedule:    '0 6 * * *',
    description: 'Draft AI campaign copy (social, email, SMS) for approved briefs using Ollama strong model',
    module:      'CampaignCopyDraftJob',
    enabled:     true,
    timeoutMs:   300_000,
  },

  {
    name:        'video-script-draft',
    schedule:    '0 6 * * *',
    description: 'Draft AI video script + hook lines for catalog videos with no script yet, using Ollama strong model',
    module:      'VideoScriptDraftJob',
    enabled:     true,
    timeoutMs:   300_000,
  },

  // ── Daily 06:30 UTC ───────────────────────────────────────────────────────
  {
    name:        'postiz-provider-health',
    schedule:    '30 6 * * *',
    description: 'Check Postiz social provider config, validate connections, generate Ollama-powered setup guidance for missing providers',
    module:      'PostizProviderHealthJob',
    enabled:     true,
    timeoutMs:   60_000,
  },

  // ── Weekly Monday 07:00 UTC ───────────────────────────────────────────────
  {
    name:        'churn-prediction',
    schedule:    '0 7 * * 1',
    description: 'Score churn risk for all active members — flag >14 days inactive with active membership',
    module:      'ChurnPredictionJob',
    enabled:     true,
    timeoutMs:   300_000,
  },
  {
    name:        'newsletter-draft',
    schedule:    '0 8 * * 1',
    description: 'AI-draft weekly newsletter (Ollama strong) from recent blog posts, events, and milestones',
    module:      'NewsletterDraftJob',
    enabled:     true,
    timeoutMs:   300_000,
  },
  {
    name:        'market-research-pricing-digest',
    schedule:    '0 8 * * 1',
    description: 'Refreshes the Market Research module\'s "pricing" topic (17-layer framework) output tab with the real live pricing_plan_price snapshot plus an Ollama advisory sentence contextualizing it against the documented $30-$120/month competitor benchmark — a deterministic fact-check discards any draft that states a dollar figure not in the real snapshot',
    module:      'MarketResearchPricingDigestJob',
    enabled:     true,
    timeoutMs:   60_000,
  },
  {
    name:        'community-digest',
    schedule:    '0 9 * * 1',
    description: 'Generate weekly community activity digest: top achievers, leaderboard movers, new badges',
    module:      'CommunityDigestJob',
    enabled:     true,
    timeoutMs:   180_000,
  },

  // ── Weekly Friday 06:00 UTC ───────────────────────────────────────────────
  {
    name:        'lead-nurturing',
    schedule:    '0 6 * * 5',
    description: 'Score and prioritize campaign leads; trigger Mautic drip sequences for warm leads',
    module:      'LeadNurturingJob',
    enabled:     true,
    timeoutMs:   180_000,
  },
  {
    name:        'seo-report',
    schedule:    '0 7 * * 5',
    description: 'AI-generate weekly SEO health report from Matomo + content analytics using Ollama',
    module:      'SeoReportJob',
    enabled:     true,
    timeoutMs:   180_000,
  },
  {
    name:        'search-visibility',
    schedule:    '15 7 * * 5',
    description: 'Write real organic-search keyword snapshots (Matomo referrer data) into marketing_search_visibility_snapshot -- no fabricated SERP position',
    module:      'SearchVisibilityJob',
    enabled:     true,
    timeoutMs:   60_000,
  },
  {
    name:        'feature-gap-advisor',
    schedule:    '0 8 * * 5',
    description: '§166 advise step — Ollama (strong) reads one module\'s own source and drafts the single highest-leverage feature missing to reach top-1% for that topic',
    module:      'FeatureGapAdvisorJob',
    enabled:     true,
    timeoutMs:   180_000,
  },
  {
    name:        'module-boundary-quality',
    schedule:    '30 8 * * 5',
    description: 'Ollama (strong) reads one module\'s own source and drafts its scope boundary, concrete dos/don\'ts, a harsh 0-100 quality score with rationale, and a benchmark note against known good patterns',
    module:      'ModuleBoundaryQualityJob',
    enabled:     true,
    timeoutMs:   180_000,
  },
  {
    name:        'voice-of-customer',
    schedule:    '0 10 * * 5',
    description: 'Clusters real inbound customer text (contact-form messages + comment sentiment) from the past 7 days into themes/complaints/requests via Ollama — skips entirely if there is no real signal that week',
    module:      'VoiceOfCustomerJob',
    enabled:     true,
    timeoutMs:   180_000,
  },

  // ── Weekly Wednesday 09:00 UTC ────────────────────────────────────────────
  {
    name:        'yoga-education-content',
    schedule:    '0 9 * * 3',
    description: 'Draft real educational/marketing content (banner, text, video script, table, list, data-narrative) across 5 topics — class list (grounded in real class_session rows), types of yoga, best practices, benefits, challenges — into the Social Scheduler review queue',
    module:      'YogaEducationContentJob',
    enabled:     true,
    timeoutMs:   600_000,
  },

  // ── Weekly Thursday 08:00 UTC ─────────────────────────────────────────────
  {
    name:        'funnel-stage-analysis',
    schedule:    '0 8 * * 4',
    description: 'Computes real per-stage unique-visitor counts and stage-to-stage conversion rates (engagement→interest→intent→lead→conversion→experience→advocacy) from tracking_event/campaign_lead/booking/survey data for the past 7 days; Ollama diagnoses the single weakest transition, reasoning only from the real computed numbers',
    module:      'FunnelStageAnalysisJob',
    enabled:     true,
    timeoutMs:   120_000,
  },
  {
    name:        'advocacy-score',
    schedule:    '30 8 * * 4',
    description: 'Computes a real composite advocacy-eligibility score per active student — NPS, attendance, retention, real referral history from the migration-052 referral domain, and churn-risk override; Ollama writes one advisory line for the single most borderline eligibility case',
    module:      'AdvocacyScoreJob',
    enabled:     true,
    timeoutMs:   180_000,
  },
  {
    name:        'referral-invitation',
    schedule:    '45 8 * * 4',
    description: 'Closes the funnel->advocacy->referral loop for real: issues a real referral_code (via the real ReferralCode domain class) to strong_candidate customers who don\'t already have one, and drafts a personalized invitation for /customer/referral — a deterministic fact-check discards any Ollama draft that invents a reward figure not in the real active campaign',
    module:      'ReferralInvitationJob',
    enabled:     true,
    timeoutMs:   180_000,
  },

  // ── Daily 07:00 UTC ───────────────────────────────────────────────────────
  {
    name:        'viral-detection',
    schedule:    '0 7 * * *',
    description: 'Computes real share/like/comment velocity per post (every platform with a connected account) from social_post_analytics snapshots and flags a post viral only when it is a real statistical outlier (z-score >= 2) against that account\'s own trailing baseline; Ollama writes one advisory sentence for the single most viral post',
    module:      'ViralDetectionJob',
    enabled:     true,
    timeoutMs:   180_000,
  },

  // ── Weekly Thursday 09:00 UTC ─────────────────────────────────────────────
  {
    name:        'influencer-value',
    schedule:    '0 9 * * 4',
    description: 'Scores known influencer profiles from real referral attribution (referral_count, revenue_attributed via their issued referral_code) — an influencer with no code issued yet is scored insufficient_data, never a fabricated number; Ollama writes one advisory line for the single highest-scoring influencer',
    module:      'InfluencerValueJob',
    enabled:     true,
    timeoutMs:   120_000,
  },

  // ── Monthly, 1st 06:00 UTC ────────────────────────────────────────────────
  {
    name:        'github-repo-scout',
    schedule:    '0 6 1 * *',
    description: 'Enriches seeded/discovered candidate repos with real GitHub API metadata (stars, description, push date) and searches a small fixed query list for genuinely new open-source reuse candidates (referral, influencer, viral-detection, social-automation) — never clones, installs, or runs anything found; Ollama writes a relevance note only for newly discovered repos, reasoning strictly from real API data',
    module:      'GitHubRepoScoutJob',
    enabled:     true,
    timeoutMs:   240_000,
  },

  // ── Daily 05:30 UTC ──────────────────────────────────────────────────────
  {
    name:        'module-registry-drift-sweep',
    schedule:    '30 5 * * *',
    description: 'Mandatory Module Understanding Standard monitor: flags module_registry rows not reverified in 30 days, and rows claiming built_status real/partial but missing required user_flow/admin_flow fields. Deterministic, no AI.',
    module:      'ModuleRegistryDriftSweepJob',
    enabled:     true,
    timeoutMs:   30_000,
  },

  // ── Every 15 minutes ─────────────────────────────────────────────────────
  {
    name:        'drip-sequence-processor',
    schedule:    '*/15 * * * *',
    description: 'Advances real multi-step drip-campaign enrollments whose next step is due, queuing each step in drip_send_log (real sequencing) — never marks a step "sent" since no SMTP/Novu is deployed in this environment.',
    module:      'DripSequenceProcessorJob',
    enabled:     true,
    timeoutMs:   60_000,
  },

  // ── Daily 04:15 UTC ──────────────────────────────────────────────────────
  {
    name:        'deep-test-advisory',
    schedule:    '15 4 * * *',
    description: 'Ollama advisory pass over the real Playwright e2e suite -- reads the most recent completed playwright_suite_run (written by the host-level run-deep-test-suite.sh cron entry at 03:00 UTC, since this container has no browser runtime), groups real failures into root-cause themes with suggested fixes, flags likely flakes, and notifies admin. No-ops gracefully if the host run has not landed yet or already has an advisory.',
    module:      'DeepTestAdvisoryJob',
    enabled:     true,
    timeoutMs:   180_000,
  },

  // ── Daily 01:30 UTC ──────────────────────────────────────────────────────
  {
    name:        'security-scan',
    schedule:    '30 1 * * *',
    description: 'AI Control Tower nightly security scan: runs every real SAST (semgrep)/SCA (npm audit + trivy fs)/IaC (trivy config + checkov on Dockerfiles)/DAST (OWASP ZAP baseline) scanner and persists findings to security_scan_run/security_finding. No AI -- real static/dynamic analysis tools only.',
    module:      'SecurityScanJob',
    enabled:     true,
    timeoutMs:   1_200_000,
  },
  {
    name:        'backlog-prioritization',
    schedule:    '30 2 * * *',
    description: 'Ollama-assessed priority/buildability/recommendation for every not_built/partial use_case_registry domain (111 domains), 5 concurrent Ollama calls per batch. Advisory only -- never changes status or deletes a row.',
    module:      'BacklogPrioritizationJob',
    enabled:     true,
    timeoutMs:   1_800_000,
  },
];

export const CRON_SCHEDULE_SUMMARY = `
CRON JOB SCHEDULE (UTC):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Every  2 min  marketing-automation (Ollama)
Every  5 min  notification-dispatch
Every 10 min  leaderboard-refresh
Every 15 min  appointment-reminder (real, no AI)
Every 30 min  abandoned-cart-recovery (Ollama)
Hourly :00    notification-retry
Hourly :15    campaign-adaptation (Ollama)
Hourly :45    campaign-health-audit (Ollama)
Hourly :20    nps-invitation
Hourly :50    nps-calculation (Ollama)
Hourly :55    csat-calculation (real, no AI)
Daily  09:00  review-request (real, no AI)
Hourly :05    social-content-idea
Daily  01:00  analytics-aggregation
Daily  02:00  streak-update
Daily  03:00  wellness-scoring (Ollama)
Daily  04:00  milestone-check
Daily  04:30  badge-award
Daily  05:00  ai-coach (Ollama)
Daily  06:00  campaign-copy-draft (Ollama)
Daily  06:30  postiz-provider-health (Ollama)
Mon    07:00  churn-prediction (Ollama)
Mon    08:00  newsletter-draft (Ollama)
Mon    08:00  market-research-pricing-digest (Ollama)
Mon    09:00  community-digest (Ollama)
Fri    06:00  lead-nurturing
Fri    07:00  seo-report (Ollama)
Fri    08:00  feature-gap-advisor (Ollama)
Fri    08:30  module-boundary-quality (Ollama)
Fri    10:00  voice-of-customer (Ollama)
Wed    09:00  yoga-education-content (Ollama)
Thu    08:00  funnel-stage-analysis (Ollama)
Thu    08:30  advocacy-score (Ollama)
Thu    08:45  referral-invitation (Ollama)
Daily  07:00  viral-detection (Ollama)
Thu    09:00  influencer-value (Ollama)
1st    06:00  github-repo-scout (Ollama)
Daily  01:30  security-scan (real tools -- no AI)
Daily  02:30  backlog-prioritization (Ollama)
Daily  03:15  opportunity-scoring (Ollama)
Daily  04:15  deep-test-advisory (Ollama) -- reads the real Playwright run written by
              scripts/run-deep-test-suite.sh (host-level, OS crontab 03:00 UTC daily,
              NOT in this in-app scheduler -- the cron container has no browser runtime)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total: 42 jobs | 27 use Ollama | 0 cloud AI tokens
`;
