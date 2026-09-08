-- Real per-customer feature opt-out, backing the new /customer/settings page.
-- Stores feature KEYS (matched against a fixed real list in the API/UI), not
-- free text -- so a disabled feature can't silently drift from what the nav
-- actually checks.
ALTER TABLE customer ADD COLUMN IF NOT EXISTS disabled_features TEXT[] NOT NULL DEFAULT '{}';
