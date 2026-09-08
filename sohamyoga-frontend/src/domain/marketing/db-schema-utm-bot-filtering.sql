-- Migration 158 (2026-09-07): bot/UA click-fraud filtering for utm_link.
-- Closes the documented gap: "No bot/UA-based click fraud filtering on the
-- /utm/[id] redirect." Bot hits still redirect correctly (a crawler/preview
-- fetcher must still reach the real destination) but are counted separately
-- rather than silently inflating click_count -- see src/lib/bot-detection.ts
-- for the heuristic and its honest limitations.
ALTER TABLE utm_link
  ADD COLUMN IF NOT EXISTS bot_click_count INTEGER NOT NULL DEFAULT 0 CHECK (bot_click_count >= 0);
