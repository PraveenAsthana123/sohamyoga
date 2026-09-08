-- Migration 161 (2026-09-08): add 'posthog' as a real tracking_pixel_config
-- platform. Closes the documented gap: "heatmap-session-replay... grep for
-- posthog/openreplay finds only comments/flag descriptions -- no actual SDK
-- import, script tag, or API key wiring anywhere in the codebase." Reuses
-- the same admin-configurable, consent-gated, fail-closed-with-no-key
-- pattern already built for Meta Pixel/GA4 this session, rather than a
-- separate table for one more third-party script.
ALTER TABLE tracking_pixel_config DROP CONSTRAINT IF EXISTS tracking_pixel_config_platform_check;
ALTER TABLE tracking_pixel_config ADD CONSTRAINT tracking_pixel_config_platform_check
  CHECK (platform = ANY (ARRAY['meta_pixel','ga4','posthog']));
