-- =============================================================================
-- Long-Form Video & YouTube Management — Module 15 of the 25-item marketing
-- management list. Was 0/15: only shared YouTube upload-metadata columns
-- bolted onto social_platform_variant existed (the Postiz auto-publish path),
-- with no independent video catalog, no view analytics, no way to browse
-- published videos on-site. This adds the real catalog + real on-site view
-- tracking, and optionally links a catalog entry to its real Postiz YouTube
-- publish record (platform_post_id/status) when one exists — never fabricates
-- YouTube-side metrics (views/watch-time/CTR) since no YouTube Data API
-- credential is wired up in this repo. Deferred (documented, not silently
-- dropped): chaptering, playlists, end-screens/cards, community-tab posts,
-- copyright/Content-ID monitoring, monetization tracking, SEO tag optimizer,
-- multi-resolution transcoding — none have a real consumer yet.
-- =============================================================================

CREATE TYPE video_asset_status AS ENUM ('draft', 'published', 'archived');

CREATE TABLE video_asset (
  id                  UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID                 NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  slug                TEXT                 NOT NULL,
  title               TEXT                 NOT NULL CHECK (title <> ''),
  description         TEXT                 NOT NULL DEFAULT '',
  tags                TEXT[]               NOT NULL DEFAULT '{}',
  duration_seconds    INTEGER              CHECK (duration_seconds IS NULL OR duration_seconds > 0),
  thumbnail_url       TEXT,
  source_url          TEXT                 NOT NULL,
  status              video_asset_status   NOT NULL DEFAULT 'draft',
  view_count          INTEGER              NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  social_variant_id   UUID                 REFERENCES social_platform_variant(id) ON DELETE SET NULL,
  published_at        TIMESTAMPTZ,
  created_by          TEXT                 NOT NULL,
  created_at          TIMESTAMPTZ          NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ          NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

CREATE INDEX idx_video_asset_tenant ON video_asset(tenant_id);
CREATE INDEX idx_video_asset_status ON video_asset(status);
