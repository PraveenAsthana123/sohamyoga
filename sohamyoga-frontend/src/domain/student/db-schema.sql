-- Student domain DB schema
-- Links to external systems: Frappe Education (frappe_student_id),
-- ERPNext (erpnext_customer_id), Chatwoot (chatwoot_contact_id).
-- Custom yoga-specific tables: personalized plan, practice journal, pose assessment, wellness scoring.
-- All tables include tenant_id for multi-tenancy.

-- ── Reference tables ──────────────────────────────────────────────────────────

CREATE TABLE ref_student_status (
  code  VARCHAR(16) PRIMARY KEY
);
INSERT INTO ref_student_status (code) VALUES
  ('active'), ('inactive'), ('paused'), ('graduated'), ('dropped');

CREATE TABLE ref_student_journey_phase (
  code  VARCHAR(32) PRIMARY KEY
);
INSERT INTO ref_student_journey_phase (code) VALUES
  ('onboarding'), ('beginner'), ('intermediate'), ('advanced'), ('ambassador');

CREATE TABLE ref_yoga_goal (
  code    VARCHAR(64) PRIMARY KEY,
  label   VARCHAR(128) NOT NULL
);
INSERT INTO ref_yoga_goal (code, label) VALUES
  ('stress_relief',     'Stress Relief'),
  ('flexibility',       'Flexibility & Mobility'),
  ('strength',          'Strength & Core'),
  ('sleep',             'Better Sleep'),
  ('mindfulness',       'Mindfulness & Meditation'),
  ('injury_recovery',   'Injury Recovery & Rehabilitation'),
  ('spiritual',         'Spiritual Growth'),
  ('weight_management', 'Weight Management'),
  ('posture',           'Posture & Alignment');

CREATE TABLE ref_enrollment_status (
  code  VARCHAR(16) PRIMARY KEY
);
INSERT INTO ref_enrollment_status (code) VALUES
  ('active'), ('completed'), ('dropped'), ('paused');

-- ── Student profile ───────────────────────────────────────────────────────────

CREATE TABLE student (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID          NOT NULL,
  user_id               UUID          NOT NULL UNIQUE,  -- Keycloak identity link
  -- External system links
  frappe_student_id     VARCHAR(64)   UNIQUE,           -- Frappe Education student ID
  erpnext_customer_id   VARCHAR(64)   UNIQUE,           -- ERPNext customer record
  chatwoot_contact_id   VARCHAR(64)   UNIQUE,           -- Chatwoot contact
  -- Profile
  display_name          VARCHAR(256)  NOT NULL,
  date_of_birth         DATE,
  gender                VARCHAR(16),
  phone                 VARCHAR(32),
  email                 VARCHAR(256)  NOT NULL,
  preferred_language    VARCHAR(8)    NOT NULL DEFAULT 'en',
  timezone              VARCHAR(64)   NOT NULL DEFAULT 'UTC',
  -- Journey & gamification
  status                VARCHAR(16)   NOT NULL DEFAULT 'onboarding' REFERENCES ref_student_status(code),
  journey_phase         VARCHAR(32)   NOT NULL DEFAULT 'onboarding' REFERENCES ref_student_journey_phase(code),
  -- Yoga profile
  yoga_style_preference VARCHAR(64)[], -- 'hatha', 'vinyasa', 'yin', 'restorative', 'kundalini', ...
  experience_level      VARCHAR(16)   NOT NULL DEFAULT 'beginner',  -- beginner/intermediate/advanced
  dosha_type            VARCHAR(16),   -- vata/pitta/kapha/tridoshic (from dosha assessment)
  -- Timestamps
  first_class_at        TIMESTAMPTZ,
  last_class_at         TIMESTAMPTZ,
  enrolled_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_student_experience CHECK (experience_level IN ('beginner','intermediate','advanced'))
);

CREATE INDEX idx_student_tenant      ON student (tenant_id, status);
CREATE INDEX idx_student_frappe      ON student (frappe_student_id) WHERE frappe_student_id IS NOT NULL;
CREATE INDEX idx_student_erpnext     ON student (erpnext_customer_id) WHERE erpnext_customer_id IS NOT NULL;

-- ── Student goals ─────────────────────────────────────────────────────────────

CREATE TABLE student_goal (
  student_id  UUID    NOT NULL REFERENCES student(id) ON DELETE CASCADE,
  goal_code   VARCHAR(64) NOT NULL REFERENCES ref_yoga_goal(code),
  priority    SMALLINT NOT NULL DEFAULT 1,   -- 1 = primary
  set_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (student_id, goal_code)
);

-- ── Guardian (for minors) ─────────────────────────────────────────────────────

CREATE TABLE student_guardian (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID          NOT NULL REFERENCES student(id) ON DELETE CASCADE,
  tenant_id     UUID          NOT NULL,
  guardian_name VARCHAR(256)  NOT NULL,
  relationship  VARCHAR(64)   NOT NULL,   -- 'parent', 'legal_guardian', 'spouse', 'other'
  phone         VARCHAR(32),
  email         VARCHAR(256),
  is_emergency  BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_guardian_student ON student_guardian (student_id);

-- ── Course enrollment (mirrors Frappe Education) ──────────────────────────────

CREATE TABLE enrollment (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID         NOT NULL,
  student_id          UUID         NOT NULL REFERENCES student(id),
  course_id           UUID         NOT NULL,   -- references yoga_course table
  frappe_enrollment_id VARCHAR(64),             -- Frappe Education enrollment doc name
  status              VARCHAR(16)  NOT NULL DEFAULT 'active' REFERENCES ref_enrollment_status(code),
  start_date          DATE         NOT NULL,
  end_date            DATE,
  fee_waived          BOOLEAN      NOT NULL DEFAULT FALSE,
  waiver_reason       TEXT,
  erpnext_fee_entry_id VARCHAR(64),             -- ERPNext fee entry link
  enrolled_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  dropped_at          TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, course_id)
);

CREATE INDEX idx_enrollment_student ON enrollment (tenant_id, student_id, status);
CREATE INDEX idx_enrollment_course  ON enrollment (course_id, status);

-- ── Attendance record (mirrors Frappe Education) ──────────────────────────────

CREATE TABLE attendance_record (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID         NOT NULL,
  student_id          UUID         NOT NULL REFERENCES student(id),
  enrollment_id       UUID         NOT NULL REFERENCES enrollment(id),
  class_session_id    UUID         NOT NULL,   -- references class_session table
  status              VARCHAR(16)  NOT NULL,   -- 'attended', 'absent', 'excused', 'late'
  check_in_method     VARCHAR(16),              -- 'qr_scan', 'manual', 'auto'
  frappe_attendance_id VARCHAR(64),
  attended_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attendance_student  ON attendance_record (tenant_id, student_id, attended_at DESC);
CREATE INDEX idx_attendance_session  ON attendance_record (class_session_id, status);

-- Attendance rate per enrollment
CREATE VIEW v_enrollment_attendance AS
  SELECT
    ar.tenant_id,
    ar.student_id,
    ar.enrollment_id,
    COUNT(*) FILTER (WHERE ar.status IN ('attended','late')) AS attended_count,
    COUNT(*) FILTER (WHERE ar.status = 'absent')            AS absent_count,
    COUNT(*)                                                AS total_count,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE ar.status IN ('attended','late')) / NULLIF(COUNT(*), 0),
      1
    )                                                       AS attendance_pct
  FROM attendance_record ar
  GROUP BY ar.tenant_id, ar.student_id, ar.enrollment_id;

-- ── Personalized yoga plan ────────────────────────────────────────────────────

CREATE TABLE personalized_plan (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID         NOT NULL,
  student_id      UUID         NOT NULL REFERENCES student(id),
  name            VARCHAR(256) NOT NULL,
  description     TEXT,
  focus_areas     VARCHAR(64)[], -- 'hip_opening', 'back_care', 'stress_relief', ...
  weekly_sessions SMALLINT     NOT NULL DEFAULT 3,
  session_minutes SMALLINT     NOT NULL DEFAULT 60,
  difficulty      VARCHAR(16)  NOT NULL DEFAULT 'beginner',
  is_ai_generated BOOLEAN      NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_by      UUID         NOT NULL,   -- teacher or admin user_id
  starts_on       DATE,
  ends_on         DATE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_plan_sessions CHECK (weekly_sessions BETWEEN 1 AND 14),
  CONSTRAINT chk_plan_minutes  CHECK (session_minutes BETWEEN 10 AND 180)
);

CREATE INDEX idx_plan_student ON personalized_plan (student_id, is_active);

-- Plan poses (ordered list of poses in a plan)
CREATE TABLE plan_pose (
  plan_id       UUID     NOT NULL REFERENCES personalized_plan(id) ON DELETE CASCADE,
  asana_id      UUID     NOT NULL,   -- references asana table
  sequence_no   SMALLINT NOT NULL,
  hold_seconds  SMALLINT NOT NULL DEFAULT 30,
  cue           TEXT,
  PRIMARY KEY (plan_id, asana_id)
);

-- ── Practice journal ──────────────────────────────────────────────────────────

CREATE TABLE practice_journal (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID         NOT NULL,
  student_id       UUID         NOT NULL REFERENCES student(id),
  entry_date       DATE         NOT NULL,
  session_type     VARCHAR(32)  NOT NULL DEFAULT 'class',  -- 'class', 'home', 'online', 'retreat'
  duration_minutes SMALLINT,
  mood_before      SMALLINT,    -- 1-5
  mood_after       SMALLINT,    -- 1-5
  energy_level     SMALLINT,    -- 1-5
  body_sensation   VARCHAR(64)[], -- 'tired', 'refreshed', 'sore', 'energised', ...
  notes            TEXT,
  is_private       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, entry_date, session_type),
  CONSTRAINT chk_journal_mood_before  CHECK (mood_before  BETWEEN 1 AND 5),
  CONSTRAINT chk_journal_mood_after   CHECK (mood_after   BETWEEN 1 AND 5),
  CONSTRAINT chk_journal_energy       CHECK (energy_level BETWEEN 1 AND 5)
);

CREATE INDEX idx_journal_student ON practice_journal (student_id, entry_date DESC);

-- ── Pose progress (pose-level mastery tracking) ───────────────────────────────

CREATE TABLE pose_assessment (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID         NOT NULL,
  student_id      UUID         NOT NULL REFERENCES student(id),
  asana_id        UUID         NOT NULL,   -- references asana table
  mastery_level   VARCHAR(16)  NOT NULL DEFAULT 'exploring',
  -- Mastery levels: exploring → learning → practising → proficient → master
  teacher_notes   TEXT,
  assessed_by     UUID,                    -- teacher user_id
  assessed_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, asana_id),
  CONSTRAINT chk_mastery CHECK (mastery_level IN ('exploring','learning','practising','proficient','master'))
);

CREATE INDEX idx_pose_assessment_student ON pose_assessment (student_id, mastery_level);
CREATE INDEX idx_pose_assessment_asana   ON pose_assessment (asana_id, mastery_level);

-- ── Wellness score ────────────────────────────────────────────────────────────

CREATE TABLE wellness_score (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID         NOT NULL,
  student_id      UUID         NOT NULL REFERENCES student(id),
  score_date      DATE         NOT NULL,
  -- Component scores (each 1-10)
  sleep_score     SMALLINT,
  mood_score      SMALLINT,
  energy_score    SMALLINT,
  activity_score  SMALLINT,
  mindfulness_score SMALLINT,
  -- Composite (0-100)
  composite_score SMALLINT     NOT NULL,
  score_method    VARCHAR(16)  NOT NULL DEFAULT 'auto',  -- 'auto' (from daily log), 'manual'
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, score_date),
  CONSTRAINT chk_ws_composite CHECK (composite_score BETWEEN 0 AND 100)
);

CREATE INDEX idx_ws_student ON wellness_score (student_id, score_date DESC);

-- 30-day wellness trend per student
CREATE VIEW v_wellness_trend AS
  SELECT
    tenant_id,
    student_id,
    AVG(composite_score)::SMALLINT AS avg_30d_score,
    MIN(composite_score)           AS min_30d_score,
    MAX(composite_score)           AS max_30d_score,
    COUNT(*)                       AS days_logged
  FROM wellness_score
  WHERE score_date >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY tenant_id, student_id;
