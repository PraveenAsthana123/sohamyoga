-- AI-assisted backlog prioritization: BacklogPrioritizationJob assesses each
-- domain (not each of the 1,200 individual sub-features -- that would be
-- ~1,200 Ollama calls for no extra signal, since sub-features within one
-- domain share the same buildability story) and writes a real, reviewable
-- recommendation. This is advisory only -- it ranks and explains, it never
-- marks anything built or deletes a row.

ALTER TABLE use_case_registry ADD COLUMN IF NOT EXISTS ai_priority TEXT CHECK (ai_priority IN ('high','medium','low'));
ALTER TABLE use_case_registry ADD COLUMN IF NOT EXISTS ai_buildability TEXT CHECK (ai_buildability IN ('buildable_now','needs_new_infra','blocked_external'));
ALTER TABLE use_case_registry ADD COLUMN IF NOT EXISTS ai_recommendation TEXT;
ALTER TABLE use_case_registry ADD COLUMN IF NOT EXISTS ai_assessed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_usecase_ai_priority ON use_case_registry (ai_priority);
