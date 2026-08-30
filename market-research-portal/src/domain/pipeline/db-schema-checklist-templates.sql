-- ============================================================
-- B2B/B2C checklist templates — additive migration.
--
-- Problem being fixed: seedFieldsForPhase() in PipelineService.ts seeded
-- every phase_run's checklist with the SAME 4 generic workflow-status
-- items regardless of phase (Reference content loaded / Research-AI draft
-- generated / Fact-check passed / Human reviewed). Those 4 gate items are
-- legitimate and are kept as-is — this migration adds real, phase-specific
-- research checklist content on top of them, and lets a study declare
-- whether the business being researched is B2B or B2C so the SAME phase
-- (e.g. "Customer segments") pulls a genuinely different checklist for a
-- consumer-facing business vs a business-to-business one.
-- ============================================================

-- study.business_model — which flavor of research questions apply to this
-- run. NOT NULL with a default so existing rows (created before this
-- migration) stay valid; every new study created through the UI is
-- required to pick one explicitly (enforced in the API route, not just
-- here).
ALTER TABLE study ADD COLUMN IF NOT EXISTS business_model TEXT NOT NULL DEFAULT 'b2c' CHECK (business_model IN ('b2b', 'b2c'));

-- phase_checklist_template — one row per (phase, business_model), holding
-- the real, concrete research checklist for that combination. `items` is
-- JSONB (array of {text}) to match how phase_run.checklist/todo_list/
-- task_list already store their arrays as JSONB rather than normalized
-- child tables — this keeps the same convention.
CREATE TABLE IF NOT EXISTS phase_checklist_template (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id       UUID NOT NULL REFERENCES phase(id) ON DELETE CASCADE,
  business_model TEXT NOT NULL CHECK (business_model IN ('b2b', 'b2c')),
  items          JSONB NOT NULL DEFAULT '[]',   -- [{text}]
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (phase_id, business_model)
);
CREATE INDEX IF NOT EXISTS idx_phase_checklist_template_phase ON phase_checklist_template(phase_id);
