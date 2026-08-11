-- =============================================================================
-- Advocacy Scoring (Phase B of the growth-loop architecture).
--
-- Referral tracking itself is NOT built here — migration 052 already
-- created a full, richer referral domain (referral_code, referral_campaign,
-- referral_click, referral_link, referral_master with a real
-- clicked→registered→verified→purchased→reward_paid lifecycle, per-
-- referrer-type eligibility, multi-channel UTM links) that had a real
-- schema but zero API/UI wiring — same "schema exists, nothing built"
-- pattern as teacher_profile earlier this session. That gets wired up
-- for real below instead of being duplicated.
--
-- advocacy_score is the genuinely new piece: composite eligibility per
-- student, computed from real signals only — NPS (survey_answer/
-- survey_response, joined by email since respondent_id is not populated
-- in this environment), attendance count, enrollment tenure, and
-- churn_prediction risk (the "recent problem overrides an old positive
-- score" rule from the spec). Positive feedback/organic sharing/
-- complaints are NOT included in v1 — no per-student link exists yet
-- between sentiment_log and a student, so including them would mean
-- guessing rather than computing; left for a later iteration once that
-- link exists for real. referral_count comes from the real
-- referral_master table once wired up.
-- =============================================================================

CREATE TABLE IF NOT EXISTS advocacy_score (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID          NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  student_id          UUID          NOT NULL REFERENCES student(id) ON DELETE CASCADE,
  nps_score           NUMERIC(5,2),
  attendance_count    INTEGER       NOT NULL DEFAULT 0,
  retention_days      INTEGER       NOT NULL DEFAULT 0,
  referral_count      INTEGER       NOT NULL DEFAULT 0,
  has_recent_problem  BOOLEAN       NOT NULL DEFAULT FALSE,
  composite_score     NUMERIC(6,2)  NOT NULL,
  eligibility         VARCHAR(20)   NOT NULL,
  computed_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, student_id),
  CONSTRAINT chk_advocacy_eligibility CHECK (eligibility IN ('strong_candidate','nurture','wait','ineligible'))
);

-- Advisory note from AdvocacyScoreJob for the single most borderline
-- eligibility case each run (added alongside the table; ALTER form kept
-- idempotent since 078 may already be marked applied in an existing DB).
ALTER TABLE advocacy_score ADD COLUMN IF NOT EXISTS ai_note TEXT;
