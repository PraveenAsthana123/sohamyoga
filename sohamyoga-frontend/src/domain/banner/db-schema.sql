-- =============================================================================
-- Banner Schema — real persistence for the Banner.ts domain model
-- Previously: Banner.ts/BannerCampaign.ts/BannerMedia.ts were real, sophisticated
-- domain code with NO backing table — /admin/banners rendered a hardcoded mock
-- array. This table is the missing persistence layer, column-for-column
-- matching BannerProps in src/domain/banner/Banner.ts.
-- =============================================================================

CREATE TYPE banner_type AS ENUM (
  'hero', 'full_screen', 'slider', 'carousel', 'video', 'inline', 'popup', 'sidebar', 'announcement'
);
CREATE TYPE banner_media_type AS ENUM ('image', 'video', 'gif', 'svg', 'lottie');
CREATE TYPE banner_status AS ENUM (
  'draft', 'pending_approval', 'approved', 'scheduled', 'active', 'paused', 'archived', 'expired'
);

CREATE TABLE banner (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID          NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  title                 TEXT          NOT NULL CHECK (title <> ''),
  slug                  TEXT          NOT NULL,
  type                  banner_type   NOT NULL,
  media_type            banner_media_type NOT NULL,
  media_url             TEXT          NOT NULL,
  thumbnail_url         TEXT,
  alt_text              TEXT          NOT NULL CHECK (alt_text <> ''),
  overlay_text          TEXT,
  headline              TEXT,
  subheadline           TEXT,
  cta_label             TEXT,
  cta_url               TEXT,
  cta_style             TEXT          CHECK (cta_style IS NULL OR cta_style IN ('primary','secondary','outline','ghost')),
  cta_tracking_id       TEXT,
  status                banner_status NOT NULL DEFAULT 'draft',
  category_id           UUID,
  category_name         TEXT,
  tags                  TEXT[]        NOT NULL DEFAULT '{}',
  is_featured           BOOLEAN       NOT NULL DEFAULT FALSE,
  is_favorite           BOOLEAN       NOT NULL DEFAULT FALSE,
  scheduled_start_at    TIMESTAMPTZ,
  scheduled_end_at      TIMESTAMPTZ,
  timezone              TEXT          NOT NULL DEFAULT 'UTC',
  is_recurring          BOOLEAN       NOT NULL DEFAULT FALSE,
  personalization       JSONB         NOT NULL DEFAULT '{}',
  auto_rotate_seconds   INTEGER,
  has_countdown         BOOLEAN       NOT NULL DEFAULT FALSE,
  countdown_end_at      TIMESTAMPTZ,
  has_gradient_overlay  BOOLEAN       NOT NULL DEFAULT FALSE,
  gradient_color        TEXT,
  is_glass_card         BOOLEAN       NOT NULL DEFAULT FALSE,
  sort_order            INTEGER       NOT NULL DEFAULT 0,
  view_count            INTEGER       NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  click_count           INTEGER       NOT NULL DEFAULT 0 CHECK (click_count >= 0),
  version               INTEGER       NOT NULL DEFAULT 1,
  approved_by           TEXT,
  approved_at           TIMESTAMPTZ,
  pause_reason          TEXT,
  rejection_reason      TEXT,
  is_published           BOOLEAN       NOT NULL DEFAULT FALSE,
  published_at          TIMESTAMPTZ,
  archived_at           TIMESTAMPTZ,
  notes                 TEXT          NOT NULL DEFAULT '',
  created_by            TEXT          NOT NULL,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

CREATE INDEX idx_banner_tenant   ON banner(tenant_id);
CREATE INDEX idx_banner_status   ON banner(status);
CREATE INDEX idx_banner_featured ON banner(is_featured) WHERE is_featured = TRUE;
