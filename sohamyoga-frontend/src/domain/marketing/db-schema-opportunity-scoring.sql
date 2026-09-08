-- AI Opportunity Scoring -- advisory-only, mirrors the ai_priority pattern
-- from use_case_registry (migration 135). ai_score is a 0-100 relative
-- priority signal, never a silently-applied probability or stage change --
-- a human still moves the opportunity through the pipeline.
ALTER TABLE opportunity ADD COLUMN IF NOT EXISTS ai_score SMALLINT CHECK (ai_score BETWEEN 0 AND 100);
ALTER TABLE opportunity ADD COLUMN IF NOT EXISTS ai_note TEXT;
ALTER TABLE opportunity ADD COLUMN IF NOT EXISTS ai_assessed_at TIMESTAMPTZ;
