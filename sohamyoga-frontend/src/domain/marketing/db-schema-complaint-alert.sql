-- =============================================================================
-- ComplaintAlertJob support: alerted_at tracking + a real staff app_user row.
--
-- app_user (referenced by ChurnPredictionJob, MilestoneCheckJob and others
-- for "who is staff to notify") had ZERO rows in this environment — every
-- staff-notification code path that queries
-- `app_user WHERE role='admin' AND status='active'` has been silently
-- finding nobody and no-op'ing, for the entire session, not just this job.
-- Seeding the real operator here fixes that for all of them, not only the
-- new ComplaintAlertJob. app_user has no FK to ASP.NET Identity (separate
-- SQLite DB) — matched by email convention only, same pattern already used
-- for student/teacher_profile.user_id.
-- =============================================================================

ALTER TABLE sentiment_log ADD COLUMN IF NOT EXISTS alerted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_sentiment_log_unalerted ON sentiment_log (created_at)
  WHERE sentiment = 'negative' AND alerted_at IS NULL;

INSERT INTO app_user (tenant_id, email, display_name, role, status)
SELECT id, 'admin@sohamyoga.ca', 'Studio Admin', 'admin', 'active' FROM tenant
ON CONFLICT (tenant_id, email) DO NOTHING;
