-- Real backing table for AudienceSegment.ts, a validated domain class (name,
-- criteria array, AND/OR logic, isDynamic flag) that had zero callers and no
-- table at all -- found orphaned during the 41-phase audit sweep. Wiring this
-- up for real CRUD only: estimatedSize starts at 0 and is only ever updated
-- by a real computation, never by the class's own PRESET_SEGMENTS constant,
-- whose hardcoded counts (284, 512, 97...) are illustrative starter data for
-- admin UI copy-paste, not a live number -- surfacing them as-is would be
-- exactly the kind of fake-live number this session has been removing
-- elsewhere. A real criteria-to-SQL evaluator (joining student/booking/
-- wellness tables per criterion field) is deliberately NOT built here --
-- that's a separate, substantial feature and is left honestly at 0/null
-- until it exists, not faked.

CREATE TABLE audience_segment (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID         NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  name             TEXT         NOT NULL CHECK (name <> ''),
  description      TEXT         NOT NULL DEFAULT '',
  criteria         JSONB        NOT NULL,
  logic            TEXT         NOT NULL DEFAULT 'AND' CHECK (logic IN ('AND', 'OR')),
  estimated_size    INTEGER      NOT NULL DEFAULT 0 CHECK (estimated_size >= 0),
  last_computed_at TIMESTAMPTZ,
  is_dynamic       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_by_id    TEXT         NOT NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_audience_segment_tenant ON audience_segment(tenant_id);
