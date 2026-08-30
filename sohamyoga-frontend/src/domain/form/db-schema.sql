-- =============================================================================
-- Form Management Schema — Module 8 of the 25-item marketing management list.
-- Was "2 of 16" real: only one hardcoded ContactForm.tsx posting to
-- /api/contact existed, no dedicated Form entity or admin-configurable
-- builder. This adds a generic, admin-defined multi-field form + submission
-- + consent capture, generalizing what /api/contact does today.
-- =============================================================================

CREATE TYPE form_status AS ENUM ('draft', 'active', 'archived');

CREATE TABLE form_definition (
  id               UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID   NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  slug             TEXT   NOT NULL,
  name             TEXT   NOT NULL CHECK (name <> ''),
  fields           JSONB  NOT NULL DEFAULT '[]',   -- [{key,label,type,required}]
  consent_required BOOLEAN NOT NULL DEFAULT TRUE,
  consent_text     TEXT   NOT NULL DEFAULT 'I agree to be contacted about this inquiry.',
  success_message  TEXT   NOT NULL DEFAULT 'Thank you — we will be in touch shortly.',
  status           form_status NOT NULL DEFAULT 'draft',
  submission_count INTEGER NOT NULL DEFAULT 0 CHECK (submission_count >= 0),
  created_by       TEXT   NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

CREATE INDEX idx_form_definition_tenant ON form_definition(tenant_id);

CREATE TABLE form_submission (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id        UUID        NOT NULL REFERENCES form_definition(id) ON DELETE CASCADE,
  data           JSONB       NOT NULL,
  consent_given  BOOLEAN     NOT NULL DEFAULT FALSE,
  source_page    TEXT,
  lead_id        UUID,       -- links to campaign_lead when one is created
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_form_submission_form ON form_submission(form_id, created_at DESC);
