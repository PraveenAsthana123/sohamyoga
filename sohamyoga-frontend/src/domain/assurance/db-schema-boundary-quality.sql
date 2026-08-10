-- Module boundary / dos-and-don'ts / quality / benchmark reports.
-- Complements feature_gap_report (the "what's missing" advisory) with a
-- "how well is what exists actually built" review — the closest thing this
-- repo has to the §166 "test" step for a module as a whole rather than a
-- single generated job output.

CREATE TABLE IF NOT EXISTS module_boundary_report (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key      VARCHAR(80)  NOT NULL,
  module_label    VARCHAR(160) NOT NULL,
  boundary_text   TEXT         NOT NULL,
  dos             TEXT[]       NOT NULL DEFAULT '{}',
  donts           TEXT[]       NOT NULL DEFAULT '{}',
  quality_score   INTEGER      NOT NULL CHECK (quality_score BETWEEN 0 AND 100),
  quality_rationale TEXT       NOT NULL,
  benchmark_note  TEXT         NOT NULL,
  evidence_files  TEXT[]       NOT NULL DEFAULT '{}',
  report_text     TEXT         NOT NULL,
  status          VARCHAR(20)  NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','dismissed')),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_module_boundary_latest ON module_boundary_report(module_key, created_at DESC);

COMMENT ON TABLE module_boundary_report IS
  'Ollama-drafted boundary/dos-and-donts/quality-score/benchmark review per module. Never auto-applied.';
