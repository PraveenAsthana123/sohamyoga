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
    name:        'campaign-adaptation',
    schedule:    '15 * * * *',
    description: 'AI-adapt pending campaign content variants for each platform using Ollama (strong model)',
    module:      'CampaignAdaptationJob',
    enabled:     true,
    timeoutMs:   300_000,
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
];

export const CRON_SCHEDULE_SUMMARY = `
CRON JOB SCHEDULE (UTC):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Every  2 min  marketing-automation (Ollama)
Every  5 min  notification-dispatch
Every 10 min  leaderboard-refresh
Every 30 min  abandoned-cart-recovery (Ollama)
Hourly :00    notification-retry
Hourly :15    campaign-adaptation (Ollama)
Hourly :45    campaign-health-audit (Ollama)
Hourly :20    nps-invitation
Hourly :50    nps-calculation (Ollama)
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
Mon    09:00  community-digest (Ollama)
Fri    06:00  lead-nurturing
Fri    07:00  seo-report (Ollama)
Fri    08:00  feature-gap-advisor (Ollama)
Fri    08:30  module-boundary-quality (Ollama)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total: 24 jobs | 15 use Ollama | 0 cloud AI tokens
`;
