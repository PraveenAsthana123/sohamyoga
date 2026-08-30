-- ============================================================
-- MARKET RESEARCH PORTAL — generic 17-phase pipeline engine
-- Database: market_research_portal (own DB, own ownership — genuine
-- schema separation from sohamyoga's DB; the 2 real cross-portal jobs
-- read sohamyoga's DB via a separate, explicitly READ-ONLY connection,
-- never through this schema).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────────
-- admin_session — single-admin session auth (env-configured admin
-- email+password, session cookie). Only the SHA-256 hash of the session
-- token is stored, never the plaintext token, so a DB read alone can't
-- forge a session.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_session (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash  TEXT NOT NULL UNIQUE,
  email       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_session_expires ON admin_session(expires_at);

-- ─────────────────────────────────────────────
-- phase — 17 static rows, ported verbatim from sohamyoga-frontend's
-- research_topic/research_topic_tab content for the 17-layer framework
-- (docs/market-research-growth-framework.md §2). Reference/definition
-- content only — never mutated at runtime.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS phase (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  layer_number      INT  NOT NULL UNIQUE CHECK (layer_number BETWEEN 1 AND 17),
  process_reference TEXT NOT NULL DEFAULT '',
  input_reference   TEXT NOT NULL DEFAULT '',
  output_reference  TEXT NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- study — one user-run of the pipeline for a given free-text topic.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS study (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_name   TEXT NOT NULL,
  created_by   TEXT NOT NULL DEFAULT 'admin',
  status       TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'running', 'completed', 'failed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- phase_run — one row per (study_id, phase_id). Carries the full
-- 13-field process sub-structure required by the Operational Portal
-- Page & Tab Standard for every process-type tab.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS phase_run (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id            UUID NOT NULL REFERENCES study(id) ON DELETE CASCADE,
  phase_id            UUID NOT NULL REFERENCES phase(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  status_history      JSONB NOT NULL DEFAULT '[]',   -- [{status, at}]
  goal                TEXT NOT NULL DEFAULT '',
  objective           TEXT NOT NULL DEFAULT '',
  todo_list           JSONB NOT NULL DEFAULT '[]',   -- [{text, done}]
  input_content       TEXT NOT NULL DEFAULT '',
  process_content     TEXT NOT NULL DEFAULT '',
  output_content      TEXT NOT NULL DEFAULT '',
  visualization_data  JSONB NOT NULL DEFAULT '{}',
  checklist           JSONB NOT NULL DEFAULT '[]',   -- [{text, done}]
  inclusion_boundary  TEXT NOT NULL DEFAULT '',
  exclusion_boundary  TEXT NOT NULL DEFAULT '',
  task_list           JSONB NOT NULL DEFAULT '[]',   -- [{text, assignee, status}]
  final_outcome_report TEXT NOT NULL DEFAULT '',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (study_id, phase_id)
);
CREATE INDEX IF NOT EXISTS idx_phase_run_study ON phase_run(study_id);
CREATE INDEX IF NOT EXISTS idx_phase_run_phase ON phase_run(phase_id);

-- ─────────────────────────────────────────────
-- phase_run_transaction — timestamped transactional history, every entry
-- with a real date+time stamp (policy §3).
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS phase_run_transaction (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  phase_run_id  UUID NOT NULL REFERENCES phase_run(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL,
  description   TEXT NOT NULL,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_phase_run_transaction_run ON phase_run_transaction(phase_run_id, occurred_at DESC);

-- ─────────────────────────────────────────────
-- phase_run_ai_log — real execution metadata backing the AI Exp / ResAI /
-- AI Governance / AI Risk tabs. Every row reflects an actual Ollama call
-- that happened — never fabricated text.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS phase_run_ai_log (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  phase_run_id      UUID NOT NULL REFERENCES phase_run(id) ON DELETE CASCADE,
  purpose           TEXT NOT NULL CHECK (purpose IN ('research_ai', 'explainability', 'governance', 'risk')),
  model_name        TEXT NOT NULL,
  prompt_chars      INT NOT NULL CHECK (prompt_chars >= 0),
  output_chars      INT NOT NULL CHECK (output_chars >= 0),
  status            TEXT NOT NULL CHECK (status IN ('succeeded', 'failed', 'fact_check_rejected')),
  fact_check_passed BOOLEAN,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_phase_run_ai_log_run ON phase_run_ai_log(phase_run_id, created_at DESC);

-- ─────────────────────────────────────────────
-- job_registry + job_run — this app's own copy of the CronRegistry /
-- operation_run pattern (ported structure from sohamyoga-frontend's
-- src/cron/CronRegistry.ts + src/domain/observability/db-schema.sql),
-- scoped to accept an optional study_id since jobs here run per-study.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_registry (
  name         TEXT PRIMARY KEY,
  schedule     TEXT NOT NULL,
  description  TEXT NOT NULL,
  module       TEXT NOT NULL,
  enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  timeout_ms   INT NOT NULL DEFAULT 120000,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_run (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name       TEXT NOT NULL REFERENCES job_registry(name),
  study_id       UUID REFERENCES study(id) ON DELETE CASCADE,
  phase_id       UUID REFERENCES phase(id) ON DELETE SET NULL,
  status         TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  duration_ms    BIGINT CHECK (duration_ms IS NULL OR duration_ms >= 0),
  error_message  TEXT,
  result_summary TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_job_run_name_time ON job_run(job_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_run_study ON job_run(study_id, created_at DESC);

-- ─────────────────────────────────────────────
-- campaign + campaign_message — communication queue, topic-agnostic
-- (email/survey/interview). send_mode: draft (human sends) | automatic
-- (scheduled, no human approval). campaign_message.status stays
-- 'not_configured' until real provider credentials exist — never a
-- simulated fake send (policy §6, plan explicit-out-of-scope note).
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id    UUID REFERENCES study(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  channel     TEXT NOT NULL CHECK (channel IN ('email', 'survey', 'interview')),
  send_mode   TEXT NOT NULL DEFAULT 'draft' CHECK (send_mode IN ('draft', 'automatic')),
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'queued', 'active', 'completed', 'cancelled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaign_message (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id    UUID NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
  recipient      TEXT NOT NULL,
  subject        TEXT,
  body           TEXT NOT NULL,
  send_mode      TEXT NOT NULL CHECK (send_mode IN ('draft', 'automatic')),
  status         TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'not_configured', 'failed')),
  scheduled_at   TIMESTAMPTZ,
  sent_at        TIMESTAMPTZ,
  error_message  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campaign_message_campaign ON campaign_message(campaign_id, created_at DESC);

-- ─────────────────────────────────────────────
-- competitor + competitor_feature — real manual CRUD backing the
-- product-comparison grid. No live scraping in this pass. feature_key/
-- feature_value form a sparse matrix so "add feature column" is just a
-- new distinct feature_key rather than a schema migration.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS competitor (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  website       TEXT,
  notes         TEXT,
  source        TEXT NOT NULL DEFAULT 'manual entry',
  collected_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS competitor_feature (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id   UUID NOT NULL REFERENCES competitor(id) ON DELETE CASCADE,
  feature_key     TEXT NOT NULL,
  feature_value   TEXT NOT NULL DEFAULT '',
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (competitor_id, feature_key)
);
CREATE INDEX IF NOT EXISTS idx_competitor_feature_competitor ON competitor_feature(competitor_id);
