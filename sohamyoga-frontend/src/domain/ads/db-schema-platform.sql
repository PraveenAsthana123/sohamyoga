-- Platform Selection: ad_campaign had no field recording which ad platform a
-- campaign targets (Google/Meta/TikTok/LinkedIn/Snapchat) -- campaigns were
-- platform-agnostic drafts with no way to filter or report by intended
-- destination. Adding the field is honest since no ad-platform account is
-- connected in this environment either way (unchanged, disclosed elsewhere);
-- this only records intent, not a live sync.
DO $$ BEGIN
  CREATE TYPE ad_platform AS ENUM ('google_ads', 'meta_ads', 'tiktok_ads', 'linkedin_ads', 'snapchat_ads', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE ad_campaign ADD COLUMN IF NOT EXISTS platform ad_platform NOT NULL DEFAULT 'google_ads';
CREATE INDEX IF NOT EXISTS idx_campaign_platform ON ad_campaign(platform);
