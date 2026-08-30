-- =============================================================================
-- Landing Page Schema — Module 7 of the 25-item marketing management list.
-- Was "0 of 16" real: no LandingPage entity existed anywhere; the whole site
-- had one hardcoded contact form and no page-builder. Scoped-down real slice:
-- a page has title/headline/subheadline/body + one linked CTA (reusing the
-- CTA registry) + SEO metadata + a real publish/version lifecycle. No
-- drag-and-drop builder or AI generation (see integration-spec note below —
-- both are large, separate features, not a database gap).
-- =============================================================================

CREATE TYPE landing_page_status AS ENUM ('draft', 'published', 'archived');

CREATE TABLE landing_page (
  id              UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID   NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  slug            TEXT   NOT NULL,
  title           TEXT   NOT NULL CHECK (title <> ''),
  headline        TEXT   NOT NULL,
  subheadline     TEXT,
  body_markdown   TEXT   NOT NULL DEFAULT '',
  cta_id          UUID   REFERENCES cta(id) ON DELETE SET NULL,
  campaign_id     UUID,
  seo_title       TEXT,
  seo_description TEXT,
  status          landing_page_status NOT NULL DEFAULT 'draft',
  view_count      INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  version         INTEGER NOT NULL DEFAULT 1,
  published_at    TIMESTAMPTZ,
  created_by      TEXT   NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

CREATE INDEX idx_landing_page_tenant ON landing_page(tenant_id);
CREATE INDEX idx_landing_page_status ON landing_page(status);

-- Real per-page version history (Module 7's "publishing workflow + versioning").
CREATE TABLE landing_page_version (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id UUID       NOT NULL REFERENCES landing_page(id) ON DELETE CASCADE,
  version        INTEGER     NOT NULL,
  title          TEXT        NOT NULL,
  headline       TEXT        NOT NULL,
  subheadline    TEXT,
  body_markdown  TEXT        NOT NULL,
  archived_by    TEXT        NOT NULL,
  archived_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (landing_page_id, version)
);
