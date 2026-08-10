-- Feature-gap advisory reports (§166 "advise" step of the Ollama global policy)
-- One row per module reviewed. Draft only — a human decides whether to act on it.

CREATE TABLE IF NOT EXISTS feature_gap_report (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key    VARCHAR(80)  NOT NULL,
  module_label  VARCHAR(160) NOT NULL,
  gap_title     TEXT         NOT NULL,
  gap_why       TEXT         NOT NULL,
  effort_tier   VARCHAR(1)   NOT NULL CHECK (effort_tier IN ('S','M','L')),
  evidence_files TEXT[]      NOT NULL DEFAULT '{}',
  report_text   TEXT         NOT NULL,
  status        VARCHAR(20)  NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','dismissed')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feature_gap_module_latest ON feature_gap_report(module_key, created_at DESC);

COMMENT ON TABLE feature_gap_report IS
  'Ollama-drafted "what would make this module top-1%" advisories. Never auto-applied.';
