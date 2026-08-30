-- =============================================================================
-- Form (lead-capture) schema — admin-defined forms with a field-builder
-- (key/label/type/required), a public submission endpoint that server-side
-- validates required fields + email format, and creates a real `contact`
-- row on submit (never a dead-end fake lead).
-- =============================================================================

CREATE TYPE form_status AS ENUM ('draft', 'active', 'archived');

CREATE TABLE form_definition (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  name             TEXT NOT NULL CHECK (name <> ''),
  description      TEXT,
  fields           JSONB NOT NULL DEFAULT '[]',  -- [{key,label,type,required}]
  success_message  TEXT NOT NULL DEFAULT 'Thank you — we will be in touch shortly.',
  status           form_status NOT NULL DEFAULT 'draft',
  submission_count INTEGER NOT NULL DEFAULT 0 CHECK (submission_count >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE form_submission (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id     UUID NOT NULL REFERENCES form_definition(id) ON DELETE CASCADE,
  data        JSONB NOT NULL,           -- raw {key: value} as submitted
  contact_id  UUID REFERENCES contact(id) ON DELETE SET NULL,  -- the real contact row it created
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_form_submission_form ON form_submission(form_id, created_at DESC);
