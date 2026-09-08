-- Migration 159 (2026-09-08): real dispatch trigger for lifecycle_campaign.
-- Closes the documented gap: "Launch/Pause only flips a status column -- no
-- real email/notification/social dispatch is triggered by launching a
-- campaign." notification_template_slug links a real notification_template;
-- dispatched_at guards against re-enqueuing on every RUNNING transition
-- (a paused-then-resumed campaign must not re-message the same audience).
ALTER TABLE lifecycle_campaign
  ADD COLUMN IF NOT EXISTS notification_template_slug TEXT,
  ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;
