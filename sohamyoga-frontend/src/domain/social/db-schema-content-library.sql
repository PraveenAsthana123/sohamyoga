-- =============================================================================
-- Post Management — Content Asset Library. Additive to the existing social
-- domain (src/domain/social) — complements, does not duplicate, the real
-- publishing engine already there (social_content_draft/social_platform_variant,
-- approval-gated publish, retries). The genuine gap this fills: no reusable
-- media/content-idea library independent of any one scheduled post. A
-- content_asset here is a real, admin-curated library item; "Use in new
-- post" pre-fills a real social_content_draft row (the real existing
-- drafting flow) rather than building a parallel draft mechanism.
-- =============================================================================

CREATE TYPE content_asset_type AS ENUM ('image', 'video', 'copy_text');

CREATE TABLE content_asset (
  id            UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID                NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  title         TEXT                NOT NULL CHECK (title <> ''),
  asset_type    content_asset_type  NOT NULL,
  file_url      TEXT,
  body_text     TEXT,
  tags          TEXT[]              NOT NULL DEFAULT '{}',
  category      TEXT,
  created_by    UUID                NOT NULL,
  created_at    TIMESTAMPTZ         NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ         NOT NULL DEFAULT now(),
  CHECK (
    (asset_type = 'copy_text' AND body_text IS NOT NULL AND body_text <> '')
    OR (asset_type IN ('image', 'video') AND file_url IS NOT NULL AND file_url <> '')
  )
);

CREATE INDEX idx_content_asset_tenant ON content_asset(tenant_id, asset_type);
CREATE INDEX idx_content_asset_category ON content_asset(category) WHERE category IS NOT NULL;
