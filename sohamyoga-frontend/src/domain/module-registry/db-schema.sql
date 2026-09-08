-- Module Understanding registry — the real, queryable backing for the
-- mandatory Module Understanding Standard policy. One row per real module,
-- across BOTH sohamyoga apps (see `app` column). A module with no row here
-- is "not yet cataloged" — the UI must say so honestly, never omit it or
-- imply it's fine.
--
-- Distinct from src/cron/moduleRegistry.ts's lightweight MODULES list (used
-- only to feed source code to Ollama for AI quality review) — that list's
-- `key` values are reused here where they overlap (crm, referral, analytics)
-- so the two registries don't drift into incompatible naming.

CREATE TABLE IF NOT EXISTS module_registry (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app                  TEXT NOT NULL CHECK (app IN ('sohamyoga-frontend', 'market-research-portal')),
  module_key           TEXT NOT NULL,
  name                 TEXT NOT NULL,
  description          TEXT NOT NULL DEFAULT '',
  built_status         TEXT NOT NULL DEFAULT 'not_yet_cataloged' CHECK (built_status IN ('real', 'partial', 'not_built', 'not_yet_cataloged')),

  user_flow            TEXT,
  admin_flow           TEXT,
  data_flow            TEXT,
  flowchart            TEXT,
  user_story           TEXT,
  input_desc           TEXT,
  process_desc         TEXT,
  output_desc          TEXT,
  final_outcome        TEXT,

  job_name             TEXT,
  report_location      TEXT,
  dashboard_location   TEXT,
  schema_tables        TEXT[] NOT NULL DEFAULT '{}',
  demo_use_cases       JSONB NOT NULL DEFAULT '[]',
  integration_platforms JSONB NOT NULL DEFAULT '[]',
  missing_items        TEXT,

  source_doc           TEXT,
  last_verified_at     TIMESTAMPTZ,
  verified_by          TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (app, module_key)
);
CREATE INDEX IF NOT EXISTS idx_module_registry_status ON module_registry(built_status);
