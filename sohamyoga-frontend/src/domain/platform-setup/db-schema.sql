-- Real, mandatory Platform Setup & Integration Center registry. Built
-- 2026-09-01 after a live audit found that most third-party integrations
-- (ads, email, calling, social bots) are genuinely credential-blocked, not
-- code-broken -- this table is the honest, actionable checklist of
-- EXACTLY what real credential each platform needs, where it's read from
-- in code today, and its real verified/not-configured status, so nothing
-- has to be re-discovered by grep next time.
CREATE TABLE IF NOT EXISTS platform_setup (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_key          TEXT NOT NULL UNIQUE,
  platform_name         TEXT NOT NULL,
  category              TEXT NOT NULL CHECK (category IN ('ads','email','calling','social','mcp','ai','other')),
  status                TEXT NOT NULL DEFAULT 'not_configured' CHECK (status IN ('not_configured','partial','configured','verified')),
  required_credentials  JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{field, description, envVarOrColumn}]
  setup_instructions    TEXT NOT NULL DEFAULT '',
  code_reference        TEXT,                                  -- real file:line where the credential is read
  use_cases             JSONB NOT NULL DEFAULT '[]'::jsonb,     -- [{title, description}]
  demo_scenario         TEXT,                                   -- real, using existing data where possible
  automation_job        TEXT,                                   -- real cron job name if one exists
  monitoring_query      TEXT,                                   -- how to check live health (real SQL/command)
  last_verified_at      TIMESTAMPTZ,
  verified_by           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_setup_status ON platform_setup(status);
CREATE INDEX IF NOT EXISTS idx_platform_setup_category ON platform_setup(category);
