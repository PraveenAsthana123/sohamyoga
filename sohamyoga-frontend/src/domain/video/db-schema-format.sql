-- =============================================================================
-- Reel & Short-Video Management — extends Module 15's video_asset catalog
-- rather than duplicating it. Reels are short-form video: same catalog
-- concept as long-form video, distinguished only by format. Adds a
-- video_asset_format enum + column (default 'long_form' so every existing
-- row stays valid with no backfill needed) and a manual hashtags column
-- (scoped down from the research's "automated hashtag suggestion" idea —
-- no AI suggestion engine here, that would be unverifiable fabrication;
-- this is real, admin-entered hashtag storage only).
-- =============================================================================

CREATE TYPE video_asset_format AS ENUM ('long_form', 'reel');

ALTER TABLE video_asset
  ADD COLUMN format video_asset_format NOT NULL DEFAULT 'long_form',
  ADD COLUMN hashtags TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX idx_video_asset_format ON video_asset(format);
