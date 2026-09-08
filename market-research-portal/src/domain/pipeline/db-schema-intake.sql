-- Real B2C/B2B customer intake form with an explicit transition path
-- (some contacts start B2C and later convert to B2B, per the source
-- conversation's own framing) -- distinct fields for each segment, not a
-- single form with irrelevant fields shown to both.
CREATE TABLE IF NOT EXISTS intake_submission (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES marketing_workspace(id) ON DELETE CASCADE,
  segment        TEXT NOT NULL CHECK (segment IN ('b2c','b2b')),
  contact_name   TEXT NOT NULL CHECK (contact_name <> ''),
  email          TEXT NOT NULL CHECK (email <> ''),
  phone          TEXT,
  company_name   TEXT,
  role           TEXT,
  use_case       TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','converted','lost')),
  converted_from_b2c_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_intake_submission_segment ON intake_submission(workspace_id, segment, status);
