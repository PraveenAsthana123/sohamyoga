import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * AI Governance data for /admin/ai-governance — eleven audit dimensions,
 * each backed by either a live query over real tables or an accurate,
 * source-cited transcription of guardrails already implemented in the
 * cron job code (src/cron/jobs/*.ts). Nothing here is invented: where a
 * dimension has genuinely sparse data (e.g. only a handful of Run Now
 * executions have been traced so far), the response reports the real
 * count rather than padding it.
 *
 * Two real limitations, reported honestly rather than hidden:
 * - The scheduled cron container (slp-cron) does not currently write to
 *   operation_run per job — only manual "Run Now" executions (source=
 *   'demo-hub') do. Accountable/Performance/Risk AI below reflect only
 *   those traced runs, not the full scheduled history (which exists only
 *   as unstructured container logs, not queryable here).
 * - model_invocation (the table designed for per-call AI telemetry) is
 *   not written by these Node cron jobs — it belongs to a separate model
 *   tracking system. Governance AI reports the model registry from it,
 *   but not per-job invocation counts.
 */

// Source-cited: derived from grep across src/cron/jobs/*.ts (tier: 'x' calls).
const MODEL_TIER_BY_JOB: Record<string, string> = {
  'marketing-automation': 'strong', 'campaign-adaptation': 'strong', 'campaign-copy-draft': 'strong', 'yoga-education-content': 'strong', 'funnel-stage-analysis': 'fast',
  'ai-coach': 'strong', 'newsletter-draft': 'strong', 'feature-gap-advisor': 'strong',
  'module-boundary-quality': 'strong', 'voice-of-customer': 'strong',
  'abandoned-cart-recovery': 'fast', 'churn-prediction': 'fast', 'community-digest': 'fast',
  'wellness-scoring': 'fast', 'campaign-health-audit': 'fast', 'seo-report': 'fast',
  'postiz-provider-health': 'fast', 'lead-nurturing': 'fast',
};

// Source-cited: each evidence string is a direct or near-direct quote from
// the named job file's own header comment.
const DECISION_AUTONOMY: Array<{ job: string; autonomy: 'draft-requires-approval' | 'advisory-informational' | 'deterministic-auto-apply'; evidence: string; file: string }> = [
  { job: 'campaign-copy-draft', autonomy: 'draft-requires-approval', evidence: 'All output saved as DRAFT — never auto-published.', file: 'CampaignCopyDraftJob.ts' },
  { job: 'yoga-education-content', autonomy: 'draft-requires-approval', evidence: 'Lands in the same social_content_draft review queue as every other content job — never auto-published; class-list content is grounded in real class_session rows, not invented.', file: 'YogaEducationContentJob.ts' },
  { job: 'funnel-stage-analysis', autonomy: 'advisory-informational', evidence: 'Writes a diagnosis of an already-computed real conversion-rate leak; never modifies funnel data or takes an action.', file: 'FunnelStageAnalysisJob.ts' },
  { job: 'ai-coach', autonomy: 'draft-requires-approval', evidence: 'Output stored as DRAFT — never auto-publishes to student.', file: 'AiCoachJob.ts' },
  { job: 'newsletter-draft', autonomy: 'draft-requires-approval', evidence: 'Store as draft template — requires staff to approve before Listmonk send.', file: 'NewsletterDraftJob.ts' },
  { job: 'abandoned-cart-recovery', autonomy: 'draft-requires-approval', evidence: 'No auto-send: draft-only pattern — staff sends manually.', file: 'AbandonedCartRecoveryJob.ts' },
  { job: 'campaign-health-audit', autonomy: 'draft-requires-approval', evidence: 'Findings are drafts requiring human acknowledgement/resolution — nothing here mutates ad_campaign, ad_group, or budget directly.', file: 'CampaignHealthAuditJob.ts' },
  { job: 'seo-report', autonomy: 'draft-requires-approval', evidence: 'Stored as draft — requires staff review before sharing.', file: 'SeoReportJob.ts' },
  { job: 'feature-gap-advisor', autonomy: 'draft-requires-approval', evidence: 'Stored as a draft advisory — never auto-applied.', file: 'FeatureGapAdvisorJob.ts' },
  { job: 'module-boundary-quality', autonomy: 'draft-requires-approval', evidence: 'Stored as a draft review — never auto-applied.', file: 'ModuleBoundaryQualityJob.ts' },
  { job: 'churn-prediction', autonomy: 'advisory-informational', evidence: 'Output is advisory ONLY — no auto-cancellations.', file: 'ChurnPredictionJob.ts' },
  { job: 'voice-of-customer', autonomy: 'advisory-informational', evidence: 'Skips entirely if no real inbound text — never fabricates a "nothing happened" report.', file: 'VoiceOfCustomerJob.ts' },
  { job: 'wellness-scoring', autonomy: 'advisory-informational', evidence: 'Computes and stores a composite score for staff/student visibility; does not gate enrollment or billing.', file: 'WellnessScoringJob.ts' },
  { job: 'community-digest', autonomy: 'advisory-informational', evidence: 'Generates a read-only weekly digest of real gamification data.', file: 'CommunityDigestJob.ts' },
  { job: 'postiz-provider-health', autonomy: 'advisory-informational', evidence: 'Reports connection health; does not connect or disconnect accounts itself.', file: 'PostizProviderHealthJob.ts' },
  { job: 'lead-nurturing', autonomy: 'advisory-informational', evidence: 'Scores leads and triggers an existing Mautic drip sequence — does not compose new outbound copy itself.', file: 'LeadNurturingJob.ts' },
  { job: 'campaign-adaptation', autonomy: 'draft-requires-approval', evidence: 'Adapts pending campaign variants that are already in draft status for platform-specific formatting.', file: 'CampaignAdaptationJob.ts' },
  { job: 'marketing-automation', autonomy: 'draft-requires-approval', evidence: 'Claims tenant campaign briefs and generates approval-ready copy — approval-ready, not auto-published.', file: 'MarketingAutomationJob.ts' },
];

const FAIRNESS_AUDIT = [
  {
    job: 'churn-prediction', inputFields: ['days_since_last_class', 'membership_status', 'current_streak', 'total_classes', 'join_date'],
    usesProtectedAttributes: false, note: 'Behavioral/engagement data only. No age, gender, ethnicity, disability, or location field is read or passed to the model.',
  },
  {
    job: 'ai-coach', inputFields: ['recent class attendance', 'student_goal.goal_code', 'streak'],
    usesProtectedAttributes: false, note: 'Practice history only. student.health_notes was deliberately excluded from the prompt (see AiCoachJob.ts) — health data is never fed to the model.',
  },
  {
    job: 'wellness-scoring', inputFields: ['mood_before', 'energy_level', 'practice_journal.notes'],
    usesProtectedAttributes: false, note: 'Self-reported wellness fields the student explicitly logs, scoped 1-5. No demographic field is read.',
  },
  {
    job: 'voice-of-customer', inputFields: ['campaign_lead.message', 'sentiment_log.text_content'],
    usesProtectedAttributes: false, note: 'Free-text message content only — no sender demographic data is included in the prompt.',
  },
];

const ETHICAL_GUARDRAILS = [
  { job: 'churn-prediction', guardrail: 'No auto-cancellation — a human decides whether and how to act on a flagged member.', file: 'ChurnPredictionJob.ts:4' },
  { job: 'abandoned-cart-recovery', guardrail: 'Recovery message is drafted, never sent — staff reviews and sends manually.', file: 'AbandonedCartRecoveryJob.ts:2-5' },
  { job: 'campaign-health-audit', guardrail: 'Ollama only writes the human-readable summary/recommendation for facts computed deterministically in SQL — it never invents a metric.', file: 'CampaignHealthAuditJob.ts:6-9' },
  { job: 'voice-of-customer', guardrail: 'System prompt explicitly instructs: only cluster what is actually in the messages given — do not invent a theme, complaint, or request that isn’t grounded in at least one real message.', file: 'VoiceOfCustomerJob.ts (SYSTEM prompt)' },
  { job: 'ai-coach', guardrail: 'Recommendations never auto-publish to the student — stored as a draft pending review.', file: 'AiCoachJob.ts:3' },
];

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const [models, tracedRuns, tracedStats, churnSamples, vocSamples, highRiskChurn, criticalFindings] = await Promise.all([
    query<{ provider: string; model_name: string; capability_codes: string[]; enabled: boolean; local_model: boolean }>(
      `SELECT provider, model_name, capability_codes, enabled, local_model FROM ai_model_master ORDER BY provider, model_name`,
    ),
    query<{ operation_name: string; status: string; actor_type: string; actor_id: string; duration_ms: number | null; created_at: string }>(
      `SELECT operation_name, status, actor_type, actor_id, duration_ms, created_at FROM operation_run WHERE source = 'demo-hub' ORDER BY created_at DESC LIMIT 25`,
    ),
    query<{ total: string; failed: string; avg_duration_ms: string | null }>(
      `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status='failed') AS failed, round(avg(duration_ms))::text AS avg_duration_ms
       FROM operation_run WHERE source = 'demo-hub'`,
    ),
    query<{ student_id: string; risk_score: number; risk_level: string; top_reason: string; suggested_action: string }>(
      `SELECT student_id, risk_score, risk_level, top_reason, suggested_action FROM churn_prediction ORDER BY predicted_at DESC LIMIT 5`,
    ),
    query<{ overall_summary: string; themes: unknown; source_message_count: number }>(
      `SELECT overall_summary, themes, source_message_count FROM voice_of_customer_digest ORDER BY period_start DESC LIMIT 1`,
    ),
    query<{ student_id: string; risk_score: number; top_reason: string }>(
      `SELECT student_id, risk_score, top_reason FROM churn_prediction WHERE risk_score >= 80 ORDER BY risk_score DESC LIMIT 10`,
    ),
    query<{ campaign_name: string; finding_key: string; summary: string }>(
      `SELECT c.name AS campaign_name, f.finding_key, f.summary FROM ad_campaign_health_finding f
       JOIN ad_campaign c ON c.id = f.campaign_id WHERE f.severity = 'critical' AND f.status = 'open' LIMIT 10`,
    ),
  ]);

  const total = Number(tracedStats.rows[0]?.total ?? 0);
  const failed = Number(tracedStats.rows[0]?.failed ?? 0);

  return Response.json({
    governance: {
      models: models.rows,
      totalModels: models.rowCount,
      totalEnabled: models.rows.filter(m => m.enabled).length,
    },
    accountable: {
      tracedRuns: tracedRuns.rows,
      totalTraced: total,
      note: total === 0
        ? 'No AI job has been run via Run Now yet — trigger one from the Use Case Catalog to see a traced, actor-attributed execution here.'
        : `${total} AI job executions traced to a specific actor (admin_demo) and timestamp.`,
    },
    explainable: {
      churnSamples: churnSamples.rows,
      voiceOfCustomerSample: vocSamples.rowCount ? vocSamples.rows[0] : null,
      note: 'Every prediction ships with its own model-generated rationale field (top_reason/suggested_action, overall_summary) — not just a bare score.',
    },
    interpretable: {
      modelTierByJob: MODEL_TIER_BY_JOB,
      note: 'Every AI-tier job specifies exactly which model tier (fast/strong) it calls in its own source — no job calls an unnamed or dynamically-chosen model.',
    },
    decision: DECISION_AUTONOMY,
    performance: {
      totalTraced: total,
      avgDurationMs: tracedStats.rows[0]?.avg_duration_ms ? Number(tracedStats.rows[0].avg_duration_ms) : null,
    },
    risk: {
      totalTraced: total,
      failed,
      failureRatePct: total ? Math.round((failed / total) * 1000) / 10 : 0,
    },
    outlier: {
      highRiskChurn: highRiskChurn.rows,
      criticalCampaignFindings: criticalFindings.rows,
    },
    fairness: FAIRNESS_AUDIT,
    ethical: ETHICAL_GUARDRAILS,
    responsible: {
      totalJobs: 29,
      ollamaJobs: 18,
      draftGatedJobs: DECISION_AUTONOMY.filter(d => d.autonomy === 'draft-requires-approval').length,
      advisoryJobs: DECISION_AUTONOMY.filter(d => d.autonomy === 'advisory-informational').length,
      modelsRegistered: models.rowCount,
      modelsEnabled: models.rows.filter(m => m.enabled).length,
    },
  });
}
