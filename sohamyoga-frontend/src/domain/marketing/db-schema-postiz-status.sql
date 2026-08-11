-- Postiz provider health tracking
-- No secret values stored here — only which providers are configured

CREATE TABLE IF NOT EXISTS postiz_provider_status (
  provider_name    TEXT         PRIMARY KEY,
  is_configured    BOOLEAN      NOT NULL DEFAULT false,
  missing_vars     TEXT[]       NOT NULL DEFAULT '{}',
  review_required  BOOLEAN      NOT NULL DEFAULT false,
  checked_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE postiz_provider_status IS
  'Tracks which Postiz social providers have valid env config. No secret values stored.';

-- Seed expected provider rows (all start as unconfigured)
INSERT INTO postiz_provider_status (provider_name, review_required) VALUES
  ('Telegram',  false),
  ('Discord',   false),
  ('Bluesky',   false),
  ('Reddit',    false),
  ('YouTube',   false),
  ('Facebook',  true ),
  ('Instagram', true ),
  ('Threads',   true ),
  ('LinkedIn',  true ),
  ('X',         false),
  ('TikTok',    true ),
  ('Pinterest', false),
  ('Mastodon',  false),
  ('Tumblr',    false),
  ('Dribbble',  false),
  ('Medium',    false),
  ('Twitch',    false)
ON CONFLICT (provider_name) DO NOTHING;
