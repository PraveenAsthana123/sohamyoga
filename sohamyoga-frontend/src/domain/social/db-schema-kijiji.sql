-- =============================================================================
-- Adds Kijiji (Canadian classifieds, eBay-owned) to ref_social_platform.
-- Added 2026-09-09 per user request ("all classified portal must be part
-- social platform as well"). Verified live: no provider file exists for
-- it in Postiz's integrations/social directory, and there is no official
-- public Kijiji posting API -- listings are posted manually through the
-- Kijiji web UI. connector='manual_only' reflects that honestly; this is
-- the first entry in a "classifieds" category, not a social feed.
-- =============================================================================

INSERT INTO ref_social_platform (platform, display_name, connector, max_characters, supports_scheduling, notes) VALUES
  ('kijiji', 'Kijiji', 'manual_only', 5000, FALSE, 'Canadian classifieds (eBay Classifieds Group). No official public posting API -- listings posted manually. First entry in the classifieds category.')
ON CONFLICT DO NOTHING;
