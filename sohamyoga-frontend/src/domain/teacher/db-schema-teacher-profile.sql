-- =============================================================================
-- teacher_profile — the base entity teacher_certification/teacher_schedule/
-- teacher_blocked_period/teacher_audit already reference by teacher_id, but
-- which was never created (their own comments say "-- FK to teacher_profile",
-- yet no such table existed anywhere in this schema until now). Scoped to
-- real, verifiable fields only — the TypeScript domain model
-- (src/domain/teacher/TeacherProfile.ts) additionally describes Frappe HR /
-- Cal.com / Moodle / Paperless-ngx integration IDs and payroll fields; none
-- of those systems are deployed, so those columns are intentionally omitted
-- rather than seeded with fabricated IDs.
-- Run AFTER: src/domain/teacher/db-schema.sql (074 already applies that)
-- =============================================================================

CREATE TABLE IF NOT EXISTS teacher_profile (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID        NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL,  -- ASP.NET Identity user id (separate SQLite DB — no cross-DB FK possible)
  first_name     VARCHAR(80)  NOT NULL,
  last_name      VARCHAR(80)  NOT NULL,
  email          VARCHAR(256) NOT NULL,
  phone          VARCHAR(32),
  bio            TEXT,
  timezone       VARCHAR(64)  NOT NULL DEFAULT 'UTC',
  status         VARCHAR(20)  NOT NULL DEFAULT 'active',
  contract_type  VARCHAR(20)  NOT NULL DEFAULT 'employee',
  specializations TEXT[]      NOT NULL DEFAULT '{}',
  hire_date      DATE         NOT NULL DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_teacher_status CHECK (status IN ('trainee','active','on_leave','retired','terminated')),
  CONSTRAINT chk_teacher_contract CHECK (contract_type IN ('employee','contractor','volunteer','intern')),
  CONSTRAINT teacher_profile_email_key UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_teacher_profile_tenant ON teacher_profile(tenant_id);
CREATE INDEX IF NOT EXISTS idx_teacher_profile_user   ON teacher_profile(user_id);
CREATE INDEX IF NOT EXISTS idx_teacher_profile_status ON teacher_profile(status);

-- Close the orphan-reference gap: these tables have carried a bare
-- teacher_id UUID with no enforced FK since they were created (074).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'teacher_certification_teacher_id_fkey'
  ) THEN
    ALTER TABLE teacher_certification
      ADD CONSTRAINT teacher_certification_teacher_id_fkey
      FOREIGN KEY (teacher_id) REFERENCES teacher_profile(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'teacher_schedule_teacher_id_fkey'
  ) THEN
    ALTER TABLE teacher_schedule
      ADD CONSTRAINT teacher_schedule_teacher_id_fkey
      FOREIGN KEY (teacher_id) REFERENCES teacher_profile(id) ON DELETE CASCADE;
  END IF;
END $$;
