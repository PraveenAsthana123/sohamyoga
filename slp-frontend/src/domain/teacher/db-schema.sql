-- =============================================================================
-- Wave 18: Teacher Management — DB Schema
-- Table-driven: all enum codes reference ref_* lookup tables
-- Tenant-driven: tenant_id FK on every domain table
-- Model-driven: TeacherCertification + TeacherSchedule entities drive structure
-- Run AFTER: src/domain/core/db-foundation.sql
-- =============================================================================

-- ─── Reference / Master Tables ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ref_certification_type (
  code        VARCHAR(40) PRIMARY KEY,
  label       VARCHAR(100) NOT NULL,
  category    VARCHAR(40) NOT NULL,     -- 'yoga_alliance' | 'first_aid' | 'safeguarding' | 'insurance' | 'specialist'
  issuing_org VARCHAR(120),
  is_expiring BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  SMALLINT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO ref_certification_type (code, label, category, issuing_org, is_expiring) VALUES
  ('ryt_200',              'RYT 200',                     'yoga_alliance', 'Yoga Alliance', FALSE),
  ('ryt_500',              'RYT 500',                     'yoga_alliance', 'Yoga Alliance', FALSE),
  ('e_ryt_200',            'E-RYT 200',                   'yoga_alliance', 'Yoga Alliance', FALSE),
  ('e_ryt_500',            'E-RYT 500',                   'yoga_alliance', 'Yoga Alliance', FALSE),
  ('cpr_first_aid',        'CPR + First Aid',             'first_aid',     NULL, TRUE),
  ('cpr_aed',              'CPR + AED',                   'first_aid',     NULL, TRUE),
  ('child_protection',     'Child Protection',            'safeguarding',  NULL, TRUE),
  ('insurance_liability',  'Liability Insurance',         'insurance',     NULL, TRUE),
  ('prenatal_certification','Prenatal Yoga',              'specialist',    NULL, TRUE),
  ('therapeutic_yoga',     'Therapeutic Yoga',            'specialist',    NULL, TRUE),
  ('aerial_yoga',          'Aerial Yoga',                 'specialist',    NULL, TRUE),
  ('hot_yoga',             'Hot Yoga (Bikram/Moksha)',    'specialist',    NULL, TRUE),
  ('kids_yoga',            'Kids Yoga',                   'specialist',    NULL, TRUE),
  ('yoga_therapy',         'Yoga Therapy (IAYT)',         'specialist',    'IAYT', TRUE)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS ref_certification_status (
  code        VARCHAR(30) PRIMARY KEY,
  label       VARCHAR(60) NOT NULL,
  sort_order  SMALLINT NOT NULL DEFAULT 0
);

INSERT INTO ref_certification_status (code, label, sort_order) VALUES
  ('pending_upload', 'Pending Upload', 1),
  ('under_review',   'Under Review',   2),
  ('verified',       'Verified',       3),
  ('rejected',       'Rejected',       4),
  ('expired',        'Expired',        5)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS ref_block_type (
  code        VARCHAR(30) PRIMARY KEY,
  label       VARCHAR(60) NOT NULL,
  affects_pay BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order  SMALLINT NOT NULL DEFAULT 0
);

INSERT INTO ref_block_type (code, label, affects_pay) VALUES
  ('holiday',    'Public Holiday',   FALSE),
  ('vacation',   'Vacation',         FALSE),
  ('personal',   'Personal Day',     FALSE),
  ('training',   'Training / CPD',   FALSE),
  ('meeting',    'Mandatory Meeting',FALSE),
  ('sick_leave', 'Sick Leave',       TRUE)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS ref_day_of_week (
  code        VARCHAR(10) PRIMARY KEY,
  label       VARCHAR(12) NOT NULL,
  iso_number  SMALLINT NOT NULL  -- 1=Monday … 7=Sunday (ISO 8601)
);

INSERT INTO ref_day_of_week (code, label, iso_number) VALUES
  ('monday',    'Monday',    1),
  ('tuesday',   'Tuesday',   2),
  ('wednesday', 'Wednesday', 3),
  ('thursday',  'Thursday',  4),
  ('friday',    'Friday',    5),
  ('saturday',  'Saturday',  6),
  ('sunday',    'Sunday',    7)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS ref_schedule_status (
  code       VARCHAR(20) PRIMARY KEY,
  label      VARCHAR(40) NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0
);

INSERT INTO ref_schedule_status (code, label, sort_order) VALUES
  ('draft',    'Draft',    1),
  ('active',   'Active',   2),
  ('archived', 'Archived', 3)
ON CONFLICT (code) DO NOTHING;

-- ─── Teacher Certification ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS teacher_certification (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID        NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  teacher_id           UUID        NOT NULL,  -- FK to teacher_profile
  type                 VARCHAR(40) NOT NULL REFERENCES ref_certification_type(code),
  issuing_organization VARCHAR(200) NOT NULL,
  certification_number VARCHAR(100),
  issued_at            DATE        NOT NULL,
  expires_at           DATE,
  status               VARCHAR(30) NOT NULL REFERENCES ref_certification_status(code) DEFAULT 'pending_upload',
  document_url         TEXT,
  verified_at          TIMESTAMPTZ,
  verified_by          VARCHAR(200),
  rejection_reason     TEXT,
  reminder_sent_at     TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_expires_after_issued  CHECK (expires_at IS NULL OR expires_at > issued_at),
  CONSTRAINT chk_verified_requires_at  CHECK (status <> 'verified' OR (verified_at IS NOT NULL AND verified_by IS NOT NULL)),
  CONSTRAINT chk_rejected_requires_reason CHECK (status <> 'rejected' OR rejection_reason IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_teacher_cert_tenant     ON teacher_certification(tenant_id);
CREATE INDEX IF NOT EXISTS idx_teacher_cert_teacher    ON teacher_certification(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_cert_status     ON teacher_certification(status);
CREATE INDEX IF NOT EXISTS idx_teacher_cert_expires    ON teacher_certification(expires_at) WHERE expires_at IS NOT NULL;

-- ─── Teacher Schedule ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS teacher_schedule (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID        NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  teacher_id     UUID        NOT NULL,
  status         VARCHAR(20) NOT NULL REFERENCES ref_schedule_status(code) DEFAULT 'draft',
  timezone       VARCHAR(60) NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_effective_to_after_from CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE INDEX IF NOT EXISTS idx_teacher_sched_tenant  ON teacher_schedule(tenant_id);
CREATE INDEX IF NOT EXISTS idx_teacher_sched_teacher ON teacher_schedule(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_sched_status  ON teacher_schedule(status);

-- Weekly recurring time slots (one row per day+time slot)
CREATE TABLE IF NOT EXISTS teacher_weekly_slot (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  schedule_id  UUID        NOT NULL REFERENCES teacher_schedule(id) ON DELETE CASCADE,
  day_of_week  VARCHAR(10) NOT NULL REFERENCES ref_day_of_week(code),
  start_time   TIME        NOT NULL,   -- HH:MM 24h stored as TIME
  end_time     TIME        NOT NULL,
  location     VARCHAR(200),
  is_recurring BOOLEAN     NOT NULL DEFAULT TRUE,

  CONSTRAINT chk_end_after_start CHECK (end_time > start_time),
  UNIQUE (schedule_id, day_of_week, start_time)
);

CREATE INDEX IF NOT EXISTS idx_weekly_slot_schedule ON teacher_weekly_slot(schedule_id);
CREATE INDEX IF NOT EXISTS idx_weekly_slot_tenant   ON teacher_weekly_slot(tenant_id);

-- Blocked periods (vacation, sick leave, etc.)
CREATE TABLE IF NOT EXISTS teacher_blocked_period (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  schedule_id UUID        NOT NULL REFERENCES teacher_schedule(id) ON DELETE CASCADE,
  type        VARCHAR(30) NOT NULL REFERENCES ref_block_type(code),
  start_date  DATE        NOT NULL,
  end_date    DATE        NOT NULL,
  reason      TEXT,

  CONSTRAINT chk_end_on_or_after_start CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_blocked_period_schedule ON teacher_blocked_period(schedule_id);
CREATE INDEX IF NOT EXISTS idx_blocked_period_dates    ON teacher_blocked_period(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_blocked_period_tenant   ON teacher_blocked_period(tenant_id);

-- ─── Audit ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS teacher_audit (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  entity_type  VARCHAR(50) NOT NULL,   -- 'certification' | 'schedule' | 'weekly_slot' | 'blocked_period'
  entity_id    UUID        NOT NULL,
  action       VARCHAR(50) NOT NULL,   -- 'created' | 'status_changed' | 'verified' | 'rejected' | 'expired'
  actor_id     VARCHAR(200),
  old_status   VARCHAR(30),
  new_status   VARCHAR(30),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teacher_audit_tenant ON teacher_audit(tenant_id);
CREATE INDEX IF NOT EXISTS idx_teacher_audit_entity ON teacher_audit(entity_type, entity_id);

-- ─── Views ────────────────────────────────────────────────────────────────────

-- Teacher certification summary per teacher
CREATE OR REPLACE VIEW v_teacher_cert_summary AS
SELECT
  tc.tenant_id,
  tc.teacher_id,
  COUNT(*)                                          AS total_certs,
  COUNT(*) FILTER (WHERE tc.status = 'verified')   AS verified_certs,
  COUNT(*) FILTER (WHERE tc.status = 'expired')    AS expired_certs,
  COUNT(*) FILTER (WHERE tc.status = 'pending_upload') AS pending_certs,
  COUNT(*) FILTER (WHERE tc.expires_at IS NOT NULL
                   AND tc.expires_at <= NOW() + INTERVAL '30 days'
                   AND tc.status = 'verified')     AS expiring_soon,
  MIN(tc.expires_at) FILTER (WHERE tc.status = 'verified'
                              AND tc.expires_at IS NOT NULL) AS next_expiry
FROM teacher_certification tc
GROUP BY tc.tenant_id, tc.teacher_id;

-- Active schedule with slot count per teacher
CREATE OR REPLACE VIEW v_teacher_active_schedule AS
SELECT
  ts.id                AS schedule_id,
  ts.tenant_id,
  ts.teacher_id,
  ts.timezone,
  ts.effective_from,
  ts.effective_to,
  COUNT(DISTINCT ws.id) AS slot_count,
  COUNT(DISTINCT bp.id) AS blocked_count
FROM teacher_schedule ts
LEFT JOIN teacher_weekly_slot ws  ON ws.schedule_id = ts.id
LEFT JOIN teacher_blocked_period bp ON bp.schedule_id = ts.id
WHERE ts.status = 'active'
GROUP BY ts.id, ts.tenant_id, ts.teacher_id, ts.timezone, ts.effective_from, ts.effective_to;

-- Expiring certifications (next 30 days) for Novu reminder job
CREATE OR REPLACE VIEW v_expiring_certifications AS
SELECT
  tc.id,
  tc.tenant_id,
  tc.teacher_id,
  tc.type,
  rct.label       AS type_label,
  tc.expires_at,
  (tc.expires_at - CURRENT_DATE) AS days_remaining
FROM teacher_certification tc
JOIN ref_certification_type rct ON rct.code = tc.type
WHERE tc.status = 'verified'
  AND tc.expires_at IS NOT NULL
  AND tc.expires_at BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days';
