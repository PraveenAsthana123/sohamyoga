-- Real credential value storage for platform_setup, added so an admin can
-- actually type in and save real credentials from the UI, not just read a
-- checklist. Honest limitation, stated plainly: this is a dev/demo
-- credential store (plaintext JSONB in the app's own database), not a
-- production secrets vault -- do not treat it as one. For social
-- platforms, saving here ALSO upserts a real social_account row so
-- FirstWaveDispatchJob/PostizSocialAutoPublishJob can actually use it. For
-- env-var-based services (Novu, Twilio, SMTP, Google/Meta Ads), saving
-- here only updates this checklist record -- the running process still
-- reads its real config from environment variables, which a web form
-- cannot safely inject into a live Node/.NET process.
ALTER TABLE platform_setup ADD COLUMN IF NOT EXISTS credential_values JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Real activation toggle: an admin can have credentials saved but still
-- turn a platform off (e.g. pause Discord posting without deleting the
-- webhook_url) -- distinct from `status`, which tracks setup progress.
ALTER TABLE platform_setup ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT false;
