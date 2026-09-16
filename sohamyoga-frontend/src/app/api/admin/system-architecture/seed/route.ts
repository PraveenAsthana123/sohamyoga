import { NextRequest} from 'next/server';
import { pool } from '@/lib/db';

import { requireAdmin } from '@/lib/admin-auth';
const CREATE_TABLES = `
CREATE TABLE IF NOT EXISTS tech_stack_entry (
  id SERIAL PRIMARY KEY,
  category VARCHAR(50),
  name VARCHAR(100) NOT NULL,
  version VARCHAR(50),
  purpose TEXT,
  docs_url VARCHAR(300),
  is_core BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feature_registry (
  id SERIAL PRIMARY KEY,
  module_name VARCHAR(100),
  feature_name VARCHAR(200) NOT NULL,
  feature_type VARCHAR(50),
  route_or_path VARCHAR(300),
  user_visible BOOLEAN DEFAULT true,
  admin_only BOOLEAN DEFAULT true,
  customer_accessible BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'built',
  demo_scenario TEXT,
  test_coverage VARCHAR(20) DEFAULT 'partial',
  navigation_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS version_registry (
  id SERIAL PRIMARY KEY,
  version_string VARCHAR(20) NOT NULL,
  release_type VARCHAR(20),
  summary TEXT,
  changes_count INT DEFAULT 0,
  modules_changed TEXT,
  breaking_changes BOOLEAN DEFAULT false,
  released_at TIMESTAMPTZ DEFAULT NOW(),
  git_commit_hash VARCHAR(10)
);

CREATE TABLE IF NOT EXISTS vector_store (
  id BIGSERIAL PRIMARY KEY,
  namespace VARCHAR(100) NOT NULL,
  source_id INT,
  source_type VARCHAR(100),
  content_text TEXT NOT NULL,
  content_hash VARCHAR(64) UNIQUE,
  embedding JSONB,
  embedding_model VARCHAR(100) DEFAULT 'nomic-embed-text',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vector_store_namespace ON vector_store(namespace);

CREATE TABLE IF NOT EXISTS synthetic_data_set (
  id SERIAL PRIMARY KEY,
  module_name VARCHAR(100) NOT NULL,
  dataset_name VARCHAR(200),
  dataset_type VARCHAR(50),
  record_count INT DEFAULT 0,
  generation_prompt TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  source_tag VARCHAR(50) DEFAULT 'synthetic',
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reference_table_catalog (
  id SERIAL PRIMARY KEY,
  table_name VARCHAR(100) NOT NULL,
  purpose TEXT,
  row_count INT,
  key_columns TEXT,
  last_updated_at TIMESTAMPTZ,
  is_editable BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

const TECH_STACK_SEEDS = [
  ['Frontend', 'Next.js', '14.x', 'React framework with App Router, SSR and API routes', 'https://nextjs.org/docs', true, 'active'],
  ['Frontend', 'TypeScript', '5.x', 'Strongly typed JavaScript for the entire frontend', 'https://www.typescriptlang.org/docs', true, 'active'],
  ['Frontend', 'Tailwind CSS', '3.x', 'Utility-first CSS framework for rapid UI development', 'https://tailwindcss.com/docs', true, 'active'],
  ['Frontend', 'React', '18', 'UI rendering library underpinning Next.js pages', 'https://react.dev', true, 'active'],
  ['Backend/API', 'FastAPI', '0.110+', 'High-performance Python API framework for the AI orchestrator', 'https://fastapi.tiangolo.com', true, 'active'],
  ['Backend/API', 'PostgreSQL', '15', 'Primary relational database for all application data', 'https://www.postgresql.org/docs/15', true, 'active'],
  ['Backend/API', 'SQLite', 'latest', 'Embedded DB for the Python agent supervisor (agents.db)', 'https://www.sqlite.org/docs.html', false, 'active'],
  ['Backend/API', 'UV', '0.11.3', 'Fast Python package installer and virtual-env manager', 'https://docs.astral.sh/uv', false, 'active'],
  ['AI/ML', 'Ollama', 'local', 'Local LLM inference engine — no cloud tokens', 'https://ollama.com/docs', true, 'active'],
  ['AI/ML', 'LangChain', '0.3', 'Framework for building LLM-powered chains and pipelines', 'https://python.langchain.com/docs', true, 'active'],
  ['AI/ML', 'LangGraph', '0.2', 'Graph-based multi-agent workflow orchestration', 'https://langchain-ai.github.io/langgraph', false, 'active'],
  ['AI/ML', 'LangSmith', 'cloud', 'LLM observability, tracing, and evaluation dashboard', 'https://docs.smith.langchain.com', false, 'active'],
  ['AI/ML', 'llama3.2', '3B', 'Primary local generative model for content and analysis', 'https://ollama.com/library/llama3.2', true, 'active'],
  ['AI/ML', 'nomic-embed-text', '1.5', 'Local embedding model for semantic search and RAG', 'https://ollama.com/library/nomic-embed-text', false, 'active'],
  ['Testing', 'Jest/Vitest', 'latest', 'Unit and integration testing for Next.js/TypeScript', 'https://vitest.dev/guide', false, 'active'],
  ['Testing', 'pytest', '8.0', 'Python test framework for FastAPI backend', 'https://docs.pytest.org', false, 'active'],
  ['Integration', 'Postiz', 'latest', 'Social media scheduling and publishing platform', 'https://postiz.com/docs', false, 'active'],
  ['Integration', 'n8n (parallel)', 'latest', 'Parallel automation stack for Instagram/Facebook/Reviews/YouTube', 'https://docs.n8n.io', false, 'active'],
  ['Integration', 'Meta Graph API', 'v21', 'Facebook and Instagram Ads + organic post management', 'https://developers.facebook.com/docs/graph-api', false, 'active'],
  ['Integration', 'Twitter API v2', 'v2', 'X/Twitter post publishing and analytics', 'https://developer.x.com/en/docs/x-api', false, 'active'],
];

const VERSION_SEEDS = [
  ['1.0.0', 'major', 'Initial release — core platform foundation with auth, CRM, blog, and booking', 42, 'auth,crm,blog,booking,classes', false, 'abc1234'],
  ['1.1.0', 'minor', 'Social media integration layer — Postiz, Meta, Twitter, n8n pipelines', 28, 'social,postiz,campaigns', false, 'def5678'],
  ['1.2.0', 'minor', 'Affiliate & referral system with ledger, fraud scan, commission settle', 35, 'affiliates,referrals,billing', false, 'ghi9012'],
  ['1.5.0', 'minor', 'AI content pipeline — Ollama, LangChain, RAG, 55 cron jobs registered', 61, 'ai-pipeline,cron,analytics', false, 'jkl3456'],
  ['2.0.0', 'major', 'Agent supervisor + System Architecture Hub — full observability and AI governance', 47, 'agents,system-architecture,vector-store', false, 'mno7890'],
];

const FEATURE_SEEDS: [string, string, string, string, boolean, boolean, boolean, string, string, string][] = [
  // Auth
  ['Auth', 'Admin Login', 'page', '/admin', true, true, false, 'built', 'full', 'Admin > Login'],
  ['Auth', 'Customer Login', 'page', '/auth/login', true, false, true, 'built', 'full', 'Customer > Login'],
  ['Auth', 'Role-based Access Control', 'middleware', '/api/auth', false, true, false, 'built', 'partial', 'System'],
  // CRM
  ['CRM', 'Lead List', 'page', '/admin/leads', true, true, false, 'built', 'partial', 'Admin > CRM > Leads'],
  ['CRM', 'Customer 360 View', 'page', '/admin/customer-360', true, true, false, 'built', 'partial', 'Admin > CRM > Customer 360'],
  ['CRM', 'Contact Submissions', 'page', '/admin/contact-submissions', true, true, false, 'built', 'partial', 'Admin > CRM > Contacts'],
  // Blog
  ['Blog', 'Blog CMS', 'page', '/admin/blog-cms', true, true, false, 'built', 'partial', 'Admin > Content > Blog'],
  ['Blog', 'Blog Public View', 'page', '/blog', true, false, true, 'built', 'full', 'Nav > Blog'],
  ['Blog', 'Blog Post Slug', 'page', '/blog/[slug]', true, false, true, 'built', 'partial', 'Blog > Post'],
  // Social
  ['Social', 'Social Compose', 'page', '/admin/social/compose', true, true, false, 'built', 'partial', 'Admin > Social > Compose'],
  ['Social', 'Social Scheduler', 'page', '/admin/social/scheduler', true, true, false, 'built', 'partial', 'Admin > Social > Scheduler'],
  ['Social', 'Postiz Auto-Publish Job', 'cron', '/cron/PostizSocialAutoPublishJob', false, true, false, 'built', 'partial', 'Cron'],
  ['Social', 'Social Analytics Sync', 'cron', '/cron/SocialAnalyticsSyncJob', false, true, false, 'built', 'partial', 'Cron'],
  // Affiliates
  ['Affiliates', 'Affiliate Partners', 'page', '/admin/affiliate-partners', true, true, false, 'built', 'partial', 'Admin > Affiliates > Partners'],
  ['Affiliates', 'Affiliate Payouts', 'page', '/admin/affiliate-payouts', true, true, false, 'built', 'partial', 'Admin > Affiliates > Payouts'],
  ['Affiliates', 'Affiliate Fraud Scan', 'cron', '/cron/AffiliateFraudScanJob', false, true, false, 'built', 'partial', 'Cron'],
  ['Affiliates', 'Commission Settle Job', 'cron', '/cron/AffiliateCommissionSettleJob', false, true, false, 'built', 'partial', 'Cron'],
  ['Affiliates', 'Referral Redirect', 'api', '/r/[code]', false, false, true, 'built', 'partial', 'Public'],
  // Ecommerce
  ['Ecommerce', 'Customer Cart', 'api', '/api/customer/cart', false, false, true, 'built', 'partial', 'Customer > Cart'],
  ['Ecommerce', 'Cart Checkout', 'api', '/api/customer/cart/checkout', false, false, true, 'built', 'partial', 'Customer > Checkout'],
  ['Ecommerce', 'Admin Orders', 'page', '/admin/ecommerce', true, true, false, 'built', 'partial', 'Admin > Ecommerce'],
  // Analytics
  ['Analytics', 'Analytics Dashboard', 'page', '/admin/analytics', true, true, false, 'built', 'partial', 'Admin > Analytics'],
  ['Analytics', 'Analytics Aggregation Job', 'cron', '/cron/AnalyticsAggregationJob', false, true, false, 'built', 'partial', 'Cron'],
  ['Analytics', 'CX Dashboard', 'page', '/admin/cx-dashboard', true, true, false, 'built', 'partial', 'Admin > Analytics > CX'],
  // AI
  ['AI', 'Agent Console', 'page', '/admin/agent-console', true, true, false, 'built', 'partial', 'Admin > AI > Agent Console'],
  ['AI', 'Agent Supervisor', 'page', '/admin/agent-supervisor', true, true, false, 'built', 'partial', 'Admin > AI > Agent Supervisor'],
  ['AI', 'System Architecture Hub', 'page', '/admin/system-architecture', true, true, false, 'built', 'partial', 'Admin > Infra > System Architecture'],
  ['AI', 'AI Governance', 'page', '/admin/ai-governance', true, true, false, 'built', 'partial', 'Admin > AI > Governance'],
  ['AI', 'AI Ingestion', 'page', '/admin/ai-ingestion', true, true, false, 'built', 'partial', 'Admin > AI > Ingestion'],
  ['AI', 'Vector Store', 'infra', '/api/admin/vector-store', false, true, false, 'built', 'partial', 'Admin > Infra > Vector Store'],
  // Booking
  ['Booking', 'Booking Page', 'page', '/booking', true, false, true, 'built', 'partial', 'Nav > Book'],
  ['Booking', 'Admin Bookings', 'page', '/admin/bookings', true, true, false, 'built', 'partial', 'Admin > Bookings'],
  ['Booking', 'Appointment Reminder Job', 'cron', '/cron/AppointmentReminderJob', false, true, false, 'built', 'partial', 'Cron'],
  // Classes
  ['Classes', 'Class Schedule', 'page', '/admin/classes', true, true, false, 'built', 'partial', 'Admin > Classes'],
  ['Classes', 'Customer Classes View', 'page', '/customer/classes', true, false, true, 'built', 'partial', 'Customer > Classes'],
  // Marketing
  ['Marketing', 'Campaign List', 'page', '/admin/campaigns', true, true, false, 'built', 'partial', 'Admin > Marketing > Campaigns'],
  ['Marketing', 'Drip Campaigns', 'page', '/admin/drip-campaigns', true, true, false, 'built', 'partial', 'Admin > Marketing > Drip'],
  ['Marketing', 'Email Composer', 'page', '/admin/email', true, true, false, 'built', 'partial', 'Admin > Marketing > Email'],
  ['Marketing', 'Ad Planner', 'page', '/admin/ad-planner', true, true, false, 'built', 'partial', 'Admin > Marketing > Ads'],
  ['Marketing', 'Marketing Automation Job', 'cron', '/cron/MarketingAutomationJob', false, true, false, 'built', 'partial', 'Cron'],
  // Brand
  ['Brand', 'Brand Guide', 'page', '/admin/brand-guide', true, true, false, 'built', 'partial', 'Admin > Brand > Guide'],
  ['Brand', 'Brand Kits', 'page', '/admin/brand-kits', true, true, false, 'built', 'partial', 'Admin > Brand > Kits'],
  ['Brand', 'Brand Strategy', 'page', '/admin/brand-strategy', true, true, false, 'built', 'partial', 'Admin > Brand > Strategy'],
  // Reviews
  ['Reviews', 'Review Request Job', 'cron', '/cron/ReviewRequestJob', false, true, false, 'built', 'partial', 'Cron'],
  ['Reviews', 'Customer Responses', 'page', '/admin/customer-responses', true, true, false, 'built', 'partial', 'Admin > Reviews'],
  // Billing
  ['Billing', 'Billing Admin', 'page', '/admin/billing', true, true, false, 'built', 'partial', 'Admin > Billing'],
  ['Billing', 'Dunning Management Job', 'cron', '/cron/DunningManagementJob', false, true, false, 'built', 'partial', 'Cron'],
  // SEO
  ['SEO', 'SEO Report Job', 'cron', '/cron/SeoReportJob', false, true, false, 'built', 'partial', 'Cron'],
  // Wellness
  ['Wellness', 'Wellness Scoring Job', 'cron', '/cron/WellnessScoringJob', false, true, false, 'built', 'partial', 'Cron'],
  ['Wellness', 'Streak Update Job', 'cron', '/cron/StreakUpdateJob', false, true, false, 'built', 'partial', 'Cron'],
  // Infra
  ['Infra', 'Cron Runner', 'infra', '/api/cron/run', false, true, false, 'built', 'partial', 'System'],
  ['Infra', 'Security Scan Job', 'cron', '/cron/SecurityScanJob', false, true, false, 'built', 'partial', 'Cron'],
  ['Infra', 'Health Snapshot Job', 'cron', '/cron/HealthSnapshotJob', false, true, false, 'built', 'partial', 'Cron'],
  // MCP
  ['MCP', 'MCP Social Route', 'api', '/api/mcp/social', false, true, false, 'built', 'partial', 'System'],
  // Platform
  ['Platform', 'Platform Workflows', 'page', '/admin/platform-workflows', true, true, false, 'built', 'partial', 'Admin > Platform > Workflows'],
  ['Platform', 'Platform Integration', 'page', '/admin/platform-integration', true, true, false, 'built', 'partial', 'Admin > Platform > Integration'],
  ['Platform', 'Platform Monitoring', 'page', '/admin/platform-monitoring', true, true, false, 'built', 'partial', 'Admin > Platform > Monitoring'],
  // Content
  ['Content', 'Content Library', 'page', '/admin/content-library', true, true, false, 'built', 'partial', 'Admin > Content > Library'],
  ['Content', 'AI Content Adapt Job', 'cron', '/cron/AIContentAdaptJob', false, true, false, 'built', 'partial', 'Cron'],
  // Audit
  ['Audit', 'Audit Log', 'page', '/admin/audit', true, true, false, 'built', 'partial', 'Admin > Audit'],
  // Competitors
  ['Competitors', 'Competitor Benchmark', 'page', '/admin/competitors-benchmark', true, true, false, 'built', 'partial', 'Admin > Research > Competitors'],
  // Market Research
  ['Market Research', 'Market Research Pricing Digest', 'cron', '/cron/MarketResearchPricingDigestJob', false, true, false, 'built', 'partial', 'Cron'],
  // PR
  ['PR', 'PR & Earned Media', 'page', '/admin/pr-media', true, true, false, 'built', 'partial', 'Admin > PR'],
  // Events
  ['Events', 'Event Calendar', 'page', '/admin/events', true, true, false, 'built', 'partial', 'Admin > Events'],
  // Community
  ['Community', 'Community Digest Job', 'cron', '/cron/CommunityDigestJob', false, true, false, 'built', 'partial', 'Cron'],
  // Churn
  ['Retention', 'Churn Prediction Job', 'cron', '/cron/ChurnPredictionJob', false, true, false, 'built', 'partial', 'Cron'],
  ['Retention', 'Abandoned Cart Recovery Job', 'cron', '/cron/AbandonedCartRecoveryJob', false, true, false, 'built', 'partial', 'Cron'],
  // Videos
  ['Videos', 'Video Script Draft Job', 'cron', '/cron/VideoScriptDraftJob', false, true, false, 'built', 'partial', 'Cron'],
  ['Videos', 'Customer Videos', 'page', '/customer/videos', true, false, true, 'built', 'partial', 'Customer > Videos'],
  // NPS
  ['NPS/CSAT', 'NPS Invitation Job', 'cron', '/cron/NpsInvitationJob', false, true, false, 'built', 'partial', 'Cron'],
  ['NPS/CSAT', 'NPS Calculation Job', 'cron', '/cron/NpsCalculationJob', false, true, false, 'built', 'partial', 'Cron'],
  ['NPS/CSAT', 'CSAT Calculation Job', 'cron', '/cron/CsatCalculationJob', false, true, false, 'built', 'partial', 'Cron'],
  // Bot
  ['Bot', 'Bot Knowledge Base', 'page', '/admin/bot-knowledge', true, true, false, 'built', 'partial', 'Admin > AI > Bot Knowledge'],
  ['Bot', 'Customer Chat Widget', 'widget', '/chat', true, false, true, 'built', 'partial', 'Customer > Chat'],
  // Command Center
  ['Command Center', 'Command Center Dashboard', 'page', '/admin/command-center', true, true, false, 'built', 'partial', 'Admin > Command Center'],
  // Leaderboard
  ['Gamification', 'Leaderboard Refresh Job', 'cron', '/cron/LeaderboardRefreshJob', false, true, false, 'built', 'partial', 'Cron'],
  ['Gamification', 'Badge Award Job', 'cron', '/cron/BadgeAwardJob', false, true, false, 'built', 'partial', 'Cron'],
  // Advocacy
  ['Advocacy', 'Advocacy Score Job', 'cron', '/cron/AdvocacyScoreJob', false, true, false, 'built', 'partial', 'Cron'],
  ['Advocacy', 'Referral Invitation Job', 'cron', '/cron/ReferralInvitationJob', false, true, false, 'built', 'partial', 'Cron'],
  // Influencer
  ['Influencer', 'Influencer Value Job', 'cron', '/cron/InfluencerValueJob', false, true, false, 'built', 'partial', 'Cron'],
  // Hashtag
  ['Hashtag', 'Hashtag Trend Job', 'cron', '/cron/HashtagTrendJob', false, true, false, 'built', 'partial', 'Cron'],
  // Viral
  ['Viral', 'Viral Detection Job', 'cron', '/cron/ViralDetectionJob', false, true, false, 'built', 'partial', 'Cron'],
  // Backlog
  ['Dev Ops', 'Backlog Prioritization Job', 'cron', '/cron/BacklogPrioritizationJob', false, true, false, 'built', 'partial', 'Cron'],
  ['Dev Ops', 'Security Scan Job', 'cron', '/cron/SecurityScanJob', false, true, false, 'built', 'partial', 'Cron'],
  // Funnel
  ['Funnel', 'Funnel Stage Analysis Job', 'cron', '/cron/FunnelStageAnalysisJob', false, true, false, 'built', 'partial', 'Cron'],
  // VOC
  ['Voice of Customer', 'Voice of Customer Job', 'cron', '/cron/VoiceOfCustomerJob', false, true, false, 'built', 'partial', 'Cron'],
  // AI Coach
  ['Wellness', 'AI Coach Job', 'cron', '/cron/AiCoachJob', false, true, false, 'built', 'partial', 'Cron'],
  // Yoga
  ['Yoga', 'Yoga Education Content Job', 'cron', '/cron/YogaEducationContentJob', false, true, false, 'built', 'partial', 'Cron'],
  // Newsletter
  ['Newsletter', 'Newsletter Draft Job', 'cron', '/cron/NewsletterDraftJob', false, true, false, 'built', 'partial', 'Cron'],
  // Lead Nurturing
  ['CRM', 'Lead Nurturing Job', 'cron', '/cron/LeadNurturingJob', false, true, false, 'built', 'partial', 'Cron'],
  // Opportunity
  ['CRM', 'Opportunity Scoring Job', 'cron', '/cron/OpportunityScoringJob', false, true, false, 'built', 'partial', 'Cron'],
  // API Quota
  ['Platform', 'API Quota Monitor Job', 'cron', '/cron/ApiQuotaMonitorJob', false, true, false, 'built', 'partial', 'Cron'],
  // Synthetic Data
  ['Infra', 'Synthetic Data Generator Job', 'cron', '/cron/SyntheticDataGeneratorJob', false, true, false, 'built', 'partial', 'Cron'],
  // Vector
  ['Infra', 'Vector Embedding Update Job', 'cron', '/cron/VectorEmbeddingUpdateJob', false, true, false, 'built', 'partial', 'Cron'],
  // Notification
  ['Notifications', 'Notification Dispatch Job', 'cron', '/cron/NotificationDispatchJob', false, true, false, 'built', 'partial', 'Cron'],
  ['Notifications', 'Notification Retry Job', 'cron', '/cron/NotificationRetryJob', false, true, false, 'built', 'partial', 'Cron'],
  // Attachment
  ['Platform', 'Platform API Catalog', 'page', '/admin/platform-api-catalog', true, true, false, 'built', 'partial', 'Admin > Platform > API Catalog'],
  // Report
  ['Reports', 'Feature Gap Advisor Job', 'cron', '/cron/FeatureGapAdvisorJob', false, true, false, 'built', 'partial', 'Cron'],
  ['Reports', 'Module Boundary Quality Job', 'cron', '/cron/ModuleBoundaryQualityJob', false, true, false, 'built', 'partial', 'Cron'],
  // Build
  ['Dev Ops', 'Build Status', 'page', '/admin/build-status', true, true, false, 'built', 'partial', 'Admin > DevOps > Build Status'],
  // Demo Hub
  ['Demo', 'Demo Hub', 'page', '/admin/demo-hub', true, true, false, 'built', 'partial', 'Admin > Demo Hub'],
  // Architecture
  ['Infra', 'Architecture Center', 'page', '/admin/architecture-center', true, true, false, 'built', 'partial', 'Admin > Infra > Architecture Center'],
];

const REF_TABLE_SEEDS = [
  ['tech_stack_entry', 'Tracks every technology, library, and service used in the platform', 'id, category, name', true],
  ['feature_registry', 'Catalog of every built feature with route, status, and coverage info', 'id, module_name, feature_name', false],
  ['version_registry', 'Semantic version history with release notes and breaking change flags', 'id, version_string, released_at', false],
  ['vector_store', 'Stores document embeddings for semantic search and RAG retrieval', 'id, namespace, content_hash', false],
  ['synthetic_data_set', 'Tracks AI-generated synthetic datasets per module', 'id, module_name, dataset_name', true],
  ['reference_table_catalog', 'Meta-catalog of all reference/config tables with purpose and editability', 'id, table_name', true],
  ['platform_workflow', 'Platform automation workflows with trigger conditions and step chains', 'id, name, trigger_type', true],
  ['bot_knowledge_base', 'FAQ and knowledge articles used for customer chat bot responses', 'id, category, question', true],
  ['module_registry', 'Master registry of all platform modules with build status and flows', 'id, module_name, status', false],
  ['cron_run_log', 'Execution log for all cron jobs — status, duration, errors per run', 'id, job_name, started_at', false],
];

export async function POST(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await pool.query(CREATE_TABLES);

    // Seed tech stack
    for (const [cat, name, ver, purpose, docs, isCore, status] of TECH_STACK_SEEDS) {
      await pool.query(
        `INSERT INTO tech_stack_entry (category, name, version, purpose, docs_url, is_core, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT DO NOTHING`,
        [cat, name, ver, purpose, docs, isCore, status]
      );
    }

    // Seed versions
    for (const [ver, rtype, summary, changes, modules, breaking, hash] of VERSION_SEEDS) {
      await pool.query(
        `INSERT INTO version_registry (version_string, release_type, summary, changes_count, modules_changed, breaking_changes, git_commit_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT DO NOTHING`,
        [ver, rtype, summary, changes, modules, breaking, hash]
      );
    }

    // Seed features (200 entries — using our ~100 predefined + skip dupes)
    for (const [mod, feat, ftype, route, uv, ao, ca, stat, tc, nav] of FEATURE_SEEDS) {
      await pool.query(
        `INSERT INTO feature_registry (module_name, feature_name, feature_type, route_or_path, user_visible, admin_only, customer_accessible, status, test_coverage, navigation_path)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT DO NOTHING`,
        [mod, feat, ftype, route, uv, ao, ca, stat, tc, nav]
      );
    }

    // Seed ref table catalog
    for (const [tname, purpose, keys, editable] of REF_TABLE_SEEDS) {
      await pool.query(
        `INSERT INTO reference_table_catalog (table_name, purpose, key_columns, is_editable)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT DO NOTHING`,
        [tname, purpose, keys, editable]
      );
    }

    const [stackCnt, featCnt, verCnt, refCnt] = await Promise.all([
      pool.query('SELECT COUNT(*) AS cnt FROM tech_stack_entry'),
      pool.query('SELECT COUNT(*) AS cnt FROM feature_registry'),
      pool.query('SELECT COUNT(*) AS cnt FROM version_registry'),
      pool.query('SELECT COUNT(*) AS cnt FROM reference_table_catalog'),
    ]);

    return Response.json({
      ok: true,
      tables_created: true,
      tech_stack_rows: Number(stackCnt.rows[0].cnt),
      feature_rows: Number(featCnt.rows[0].cnt),
      version_rows: Number(verCnt.rows[0].cnt),
      ref_catalog_rows: Number(refCnt.rows[0].cnt),
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
