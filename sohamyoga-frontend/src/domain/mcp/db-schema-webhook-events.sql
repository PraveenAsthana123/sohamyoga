-- Real inbound-webhook receipt log for the external MCP platforms that
-- actually support pushing events to third-party apps. Of the 14 platforms
-- tracked in external-platform-mcp.ts, only GitHub, GitLab, and Patreon
-- have public, documented webhook systems -- the other 11 (Yelp,
-- TripAdvisor, StackOverflow, SoundCloud, Spotify, Apple Podcasts,
-- Substack, Trustpilot, Vimeo, Dailymotion, Snapchat) either have no
-- third-party webhook capability at all or require enterprise partnership
-- access this project doesn't have. No receiver was built for those --
-- fabricating one would misrepresent a capability that doesn't exist.
CREATE TABLE IF NOT EXISTS external_webhook_event (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform      TEXT NOT NULL CHECK (platform IN ('github', 'gitlab', 'patreon')),
  event_type    TEXT NOT NULL,
  signature_valid BOOLEAN NOT NULL,
  payload       JSONB NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_external_webhook_event_platform ON external_webhook_event(platform, received_at DESC);
