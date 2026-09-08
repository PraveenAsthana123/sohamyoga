-- Real preference fields for the customer self-service Preferences page
-- (previously a pure-mock page with a fake setTimeout "Saved" toast and a
-- TODO comment for the real POST that never existed).
ALTER TABLE customer ADD COLUMN IF NOT EXISTS preferred_class_styles TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE customer ADD COLUMN IF NOT EXISTS preferred_class_times TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE customer ADD COLUMN IF NOT EXISTS reminder_minutes_before INT NOT NULL DEFAULT 30;
ALTER TABLE customer ADD COLUMN IF NOT EXISTS goal_statement TEXT NOT NULL DEFAULT '';
