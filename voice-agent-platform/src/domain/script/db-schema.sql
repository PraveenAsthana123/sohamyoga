-- =============================================================================
-- Call script schema — versioned call scripts tied to a clinic service type.
-- A `call_script` is a stable identity (slug/name/service type); each edit
-- creates a new `call_script_version` row rather than overwriting content in
-- place, so history is preserved. `call_script.published_version_id` points
-- at whichever version is currently live; publishing a new version archives
-- the previously-published one instead of deleting it.
-- =============================================================================

CREATE TYPE clinic_service_type AS ENUM ('dental', 'chiropractic', 'physiotherapy', 'ent', 'massage_therapy');
CREATE TYPE call_script_version_status AS ENUM ('draft', 'published', 'archived');

CREATE TABLE call_script (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                 TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  name                 TEXT NOT NULL CHECK (name <> ''),
  service_type         clinic_service_type NOT NULL,
  published_version_id UUID,  -- FK added below, after call_script_version exists
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE call_script_version (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id      UUID NOT NULL REFERENCES call_script(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  -- Structured content: {opening, discovery_questions[], objection_handling, closing}
  sections       JSONB NOT NULL,
  status         call_script_version_status NOT NULL DEFAULT 'draft',
  created_by     TEXT NOT NULL DEFAULT 'admin',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (script_id, version_number)
);

ALTER TABLE call_script
  ADD CONSTRAINT fk_call_script_published_version
  FOREIGN KEY (published_version_id) REFERENCES call_script_version(id) ON DELETE SET NULL;

CREATE INDEX idx_call_script_version_script ON call_script_version(script_id, version_number DESC);
CREATE INDEX idx_call_script_service_type ON call_script(service_type);
