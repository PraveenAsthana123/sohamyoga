-- =============================================================================
-- Extends ref_social_platform (migration 020) with 4 genuinely real Postiz
-- providers that were not yet registered: tumblr, medium, dribbble, twitch.
--
-- Verified against Postiz's own source (gitroomhq/postiz-app,
-- libraries/nestjs-libraries/src/integrations/social/*.provider.ts) rather
-- than assumed — max_characters below is each provider's real maxLength()
-- return value, not an estimate:
--   tumblr.provider.ts   maxLength() -> 32768
--   medium.provider.ts   maxLength() -> 100000
--   dribbble.provider.ts maxLength() -> 40000
--   twitch.provider.ts   maxLength() -> 500 (Twitch chat message, not a post
--                          in the same sense as the others — flagged in notes)
--
-- Tumblr and Dribbble use real OAuth env vars already present in Postiz's
-- own .env.example (TUMBLR_CLIENT_ID/SECRET, DRIBBBLE_CLIENT_ID/SECRET) —
-- see PostizProviderHealthJob.ts. Medium and Twitch have no such env vars
-- in Postiz's .env.example, so they are connected directly through the
-- Postiz UI rather than a separate developer-app registration step — that
-- is real, verified absence of a requirement, not an oversight.
--
-- Of the user's separately-researched 30-platform priority table, most of
-- the remaining entries (Snapchat, Substack, GitHub, GitLab, Stack
-- Overflow, Yelp, Tripadvisor, Trustpilot, Vimeo, Dailymotion, Spotify,
-- Apple Podcasts, SoundCloud, Patreon) are NOT Postiz providers at all —
-- confirmed by listing Postiz's real integrations/social directory, which
-- has no provider file for any of them. Registering them here would imply
-- a real integration path that does not exist.
-- =============================================================================

INSERT INTO ref_social_platform (platform, display_name, connector, max_characters, supports_scheduling, notes) VALUES
  ('tumblr',   'Tumblr',   'postiz', 32768,  TRUE, 'Real Postiz OAuth provider — TUMBLR_CLIENT_ID/SECRET'),
  ('medium',   'Medium',   'postiz', 100000, TRUE, 'Real Postiz provider — no separate developer app; connect via Postiz UI'),
  ('dribbble', 'Dribbble', 'postiz', 40000,  TRUE, 'Real Postiz OAuth provider — DRIBBBLE_CLIENT_ID/SECRET; image-shot platform'),
  ('twitch',   'Twitch',   'postiz', 500,    TRUE, 'Real Postiz provider — 500-char limit is a chat/announcement message, not a full post; no separate developer app')
ON CONFLICT DO NOTHING;
