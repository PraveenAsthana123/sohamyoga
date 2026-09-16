# Database Standard — sohamyoga Platform

> **Version:** 2.0.0 · **Engine:** PostgreSQL 15 · **Port:** 5437

## Schema Design Rules

| Rule | Requirement | Example |
|------|-------------|---------|
| DB-1 | Every table: `id SERIAL/BIGSERIAL PRIMARY KEY` | `id SERIAL PRIMARY KEY` |
| DB-2 | Every table: `created_at TIMESTAMPTZ DEFAULT NOW()` | — |
| DB-3 | Mutable tables: `updated_at TIMESTAMPTZ DEFAULT NOW()` | — |
| DB-4 | CREATE TABLE must use `IF NOT EXISTS` | — |
| DB-5 | Seed INSERTs must use `ON CONFLICT DO NOTHING` | — |
| DB-6 | FK columns must declare `ON DELETE` behavior | `ON DELETE CASCADE` |
| DB-7 | Index all FK columns + filtered columns | `CREATE INDEX IF NOT EXISTS` |
| DB-8 | JSONB for flex config; typed columns for queryable fields | `status VARCHAR(20)` |
| DB-9 | Use `TIMESTAMPTZ` not `TIMESTAMP` (timezone-aware) | — |
| DB-10 | Enum-like columns use `VARCHAR(20-50)` with CHECK or comment | `status VARCHAR(20) -- draft\|active\|archived` |

## Table Taxonomy

```
ref_*              → Reference/lookup tables (36 platforms, content types)
platform_*         → Per-platform integration state and logs
module_*           → Module registry and intelligence
affiliate_*        → Affiliate program (partners, tiers, payouts, fraud)
social_*           → Social intelligence (analytics, hashtags, calendar)
market_*           → Market research (projects, scenarios, competitors, insights)
ai_*               → AI governance (audit logs, model performance)
bot_*              → Customer service bot (sessions, messages, knowledge base)
brand_*            → Branding (assets, guidelines, mentions)
blog_*             → Blog CMS (posts, categories)
lead / lead_*      → Lead generation (leads, activities, forms)
survey_*           → Survey (questions, responses, answers)
calendar_*         → Calendar integration (providers, events)
notification / broadcast → Notification and broadcast system
platform_workflow_*  → Workflow engine (workflows, steps, runs)
platform_api_*     → API catalog and quota monitoring
platform_health_*  → Platform health checks
security_*         → Security audit and config checks
quality_*          → Quality benchmarks
vector_*           → Vector store for semantic search
synthetic_*        → Synthetic data registry
tech_*             → Tech stack registry
feature_*          → Feature registry
version_*          → Version registry
service_*          → Service tickets
```

## Current Table Inventory (2026-09-16)

**Platform Integration (27 tables)**
- `platform_integration_config`, `platform_system_account`, `platform_webhook_config`, `platform_customer_toggle`
- `platform_workflow`, `platform_workflow_step`, `platform_workflow_run`, `platform_workflow_step_run`, `platform_ai_content_job`
- `platform_api_log`, `platform_health_check`, `platform_rate_limit_snapshot`, `platform_webhook_event`, `platform_retry_queue`
- `platform_scenario`, `platform_feature_permission`, `platform_scenario_run`, `platform_review`, `platform_insight`, `platform_content_feedback`
- `platform_api_offering`, `platform_api_quota`, `platform_api_changelog`, `platform_api_test_result`
- `platform_credential_config`, `platform_setup_step`, `platform_setup_log`

**Business Modules**
- `affiliate_partner`, `affiliate_tier_rule`, `affiliate_payout`, `affiliate_material`, `affiliate_fraud_flag`, `affiliate_campaign`
- `social_content_variant`, `social_platform_analytics`, `social_hashtag_performance`, `social_calendar_entry`, `social_alert_rule`, `social_alert_event`
- `unified_content_item`, `unified_content_action_log`
- `market_research_project`, `market_research_scenario`, `market_research_document`, `market_competitor`, `market_insight`
- `lead`, `lead_activity`, `lead_form`
- `blog_post`, `blog_category`
- `contact_submission`
- `survey`, `survey_question`, `survey_response`, `survey_answer`
- `calendar_integration`, `calendar_event`
- `notification`, `alert_rule`, `broadcast`
- `bot_session`, `bot_message`, `bot_knowledge_base`, `service_ticket`
- `brand_asset`, `brand_guideline`, `brand_mention`

**AI & Governance**
- `ai_governance_log`, `ai_model_performance`
- `security_audit_log`, `security_config_check`
- `quality_benchmark`
- `vector_store`, `synthetic_data_set`

**Registry & Meta**
- `module_registry` (221+ modules), `ref_social_platform` (36 platforms)
- `tech_stack_entry`, `feature_registry`, `version_registry`, `reference_table_catalog`
- `test_plan`, `test_case_extended`, `test_run_session`, `test_run_result`
- `agent_run`, `agent_test_case`, `agent_test_result` (SQLite — AI orchestrator)

## Migration Policy

No migration framework is currently used. Schema changes via:

1. `IF NOT EXISTS` in API seed routes (auto-creates on first hit)
2. `ALTER TABLE` scripts committed to `docs/migrations/YYYY-MM-DD_description.sql`
3. Rollback script committed alongside every migration

**Never run destructive DDL (DROP TABLE, DROP COLUMN) without:**
- A backup verified within 24h
- A rollback script
- Team notification

## Query Performance

```sql
-- Explain every slow query (>100ms)
EXPLAIN ANALYZE SELECT ...;

-- Key indexes already in place:
CREATE INDEX idx_platform_api_log_platform ON platform_api_log(platform);
CREATE INDEX idx_platform_api_log_created ON platform_api_log(created_at DESC);
CREATE INDEX idx_lead_stage ON lead(lead_stage);
CREATE INDEX idx_lead_source ON lead(lead_source);
CREATE INDEX idx_bot_session_token ON bot_session(session_token);
CREATE INDEX idx_vector_store_namespace ON vector_store(namespace);
CREATE INDEX idx_ai_governance_log_module ON ai_governance_log(module_name);
CREATE INDEX idx_security_audit_log_event ON security_audit_log(event_type, created_at DESC);
```
