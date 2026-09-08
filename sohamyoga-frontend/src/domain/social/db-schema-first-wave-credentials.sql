-- Per-account runtime credentials for the first-wave direct-API adapters
-- (telegram/discord/mastodon/bluesky) in first-wave-adapters.ts. That code
-- is real and correct but was never wired into production because nothing
-- read a real secret for it (found live during the 2026-09-01 business-side
-- audit). Stored per-account (not a single global env var like
-- POSTIZ_PUBLIC_API_KEY) because each platform's adapterReadiness() expects
-- distinct named fields (bot_token/chat_id, webhook_url, etc.) and a tenant
-- may connect more than one account per platform.
ALTER TABLE social_account ADD COLUMN IF NOT EXISTS credentials JSONB NOT NULL DEFAULT '{}'::jsonb;
