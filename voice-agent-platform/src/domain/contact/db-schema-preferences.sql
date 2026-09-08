-- Real "master data" store for what a customer actually said during a
-- needs/preference survey call (yoga_needs_survey scenario or similar) --
-- distinct from the raw transcript text, which is unstructured. This is
-- ADMIN-ENTERED after listening to/reading the call, same as quality_score
-- on call_log -- there is no transcript-parsing/NLP extraction in this
-- codebase, and fabricating one would misrepresent human-entered data as
-- AI-extracted. One contact can have multiple rows (preferences may be
-- re-collected on a later call); the most recent row is the current state.
CREATE TABLE customer_preference (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id            UUID NOT NULL REFERENCES contact(id) ON DELETE CASCADE,
  call_id               UUID REFERENCES call_log(id) ON DELETE SET NULL,
  preferred_style       TEXT,
  experience_level      TEXT CHECK (experience_level IS NULL OR experience_level IN ('beginner', 'intermediate', 'advanced')),
  preferred_time        TEXT CHECK (preferred_time IS NULL OR preferred_time IN ('morning', 'afternoon', 'evening')),
  session_length_minutes INTEGER CHECK (session_length_minutes IS NULL OR session_length_minutes > 0),
  classes_per_week      INTEGER CHECK (classes_per_week IS NULL OR classes_per_week >= 0),
  budget_amount         NUMERIC(10, 2) CHECK (budget_amount IS NULL OR budget_amount >= 0),
  budget_period         TEXT CHECK (budget_period IS NULL OR budget_period IN ('per_class', 'monthly')),
  physical_notes        TEXT,
  collected_by          TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_preference_contact ON customer_preference(contact_id, created_at DESC);
