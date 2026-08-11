-- AiCoachJob (built earlier, registered in CronRegistry) has always written
-- to a table that never existed — "relation ai_recommendation does not
-- exist" on every single run, confirmed live 2026-08-11. Draft-only
-- (status='draft') — never auto-pushed to the student, matches the
-- established human-review pattern used throughout this session.

CREATE TABLE IF NOT EXISTS ai_recommendation (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID         NOT NULL,
  student_id            UUID         NOT NULL REFERENCES student(id) ON DELETE CASCADE,
  rec_date              DATE         NOT NULL,
  recommendation_json   JSONB        NOT NULL,
  model_used            TEXT         NOT NULL,
  status                VARCHAR(16)  NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'shown', 'dismissed')),
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (student_id, rec_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_recommendation_student ON ai_recommendation (student_id, rec_date DESC);
