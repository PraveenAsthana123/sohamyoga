-- Customer Occasion Messaging (birthday/anniversary/festival/custom),
-- added 2026-09-14. Admin-level only (no customer self-service surface,
-- per explicit request). Real gap found before building this: student
-- already has real date_of_birth + enrolled_at (usable for birthday/
-- anniversary) but no country field for location-festival matching, and
-- no persisted wish-card entity despite WishCard.ts / WISH_TEMPLATES /
-- the notification.wish_cards feature flag already existing as orphaned
-- domain code with nothing behind it (see architecture doc).
--
-- Real sends flow through the EXISTING real notification_queue /
-- NotificationDispatchJob machinery (not a new bespoke sender) -- push
-- and in_app genuinely deliver today; email/sms/whatsapp attempt a real
-- Novu call and honestly fail if Novu isn't configured/running in this
-- environment, same as every other notification in this codebase.
-- wish_card is the occasion-specific record of intent; it links to the
-- real notification_queue row that carries the actual dispatch outcome.

ALTER TABLE student ADD COLUMN IF NOT EXISTS country VARCHAR(2); -- real, ISO-2, admin/import-entered, never inferred -- drives location-festival matching

CREATE TABLE IF NOT EXISTS festival_calendar (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID          NOT NULL,
  code           VARCHAR(64)   NOT NULL,
  name           VARCHAR(120)  NOT NULL,
  occasion_date  DATE          NOT NULL,
  country        VARCHAR(2),   -- NULL = global (applies regardless of student.country)
  is_active      BOOLEAN       NOT NULL DEFAULT TRUE,
  created_by     UUID,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);
CREATE INDEX IF NOT EXISTS idx_festival_calendar_date ON festival_calendar (tenant_id, occasion_date);

CREATE TABLE IF NOT EXISTS wish_card (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID          NOT NULL,
  student_id            UUID          NOT NULL REFERENCES student(id) ON DELETE CASCADE,
  occasion              VARCHAR(20)   NOT NULL CHECK (occasion IN ('birthday','member_anniversary','festival','custom')),
  festival_code         VARCHAR(64), -- soft reference to festival_calendar.code -- not a hard FK because code's real uniqueness is scoped (tenant_id, code), not code alone
  title                 VARCHAR(200)  NOT NULL,
  message               TEXT          NOT NULL,
  style                 VARCHAR(20)   NOT NULL DEFAULT 'yoga_themed' CHECK (style IN ('simple','animated','photo','yoga_themed')),
  channel               VARCHAR(16)   NOT NULL CHECK (channel IN ('email','sms','whatsapp','push','in_app')),
  status                VARCHAR(10)   NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SENT','OPENED','FAILED')),
  notification_queue_id UUID,        -- real link to the actual dispatch row once enqueued -- delivery outcome lives there, not fabricated here
  scheduled_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  sent_at               TIMESTAMPTZ,
  created_by            UUID,         -- NULL = system (automated scan), set = admin who sent a custom card
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wish_card_student ON wish_card (tenant_id, student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wish_card_status ON wish_card (tenant_id, status);
-- Real same-day dedupe: prevents the daily scan re-sending the same
-- occasion to the same student twice if the job runs more than once on
-- the same real calendar day. A custom send (occasion='custom') is
-- intentionally not covered by this index -- an admin may legitimately
-- send more than one custom message to the same student on the same day.
-- (scheduled_at::date) alone is not IMMUTABLE (depends on session
-- timezone) and Postgres rejects it in an index expression; casting via
-- a fixed 'UTC' zone first makes the expression deterministic.
CREATE UNIQUE INDEX IF NOT EXISTS uq_wish_card_student_occasion_day
  ON wish_card (tenant_id, student_id, occasion, COALESCE(festival_code, ''), ((scheduled_at AT TIME ZONE 'UTC')::date))
  WHERE occasion IN ('birthday', 'member_anniversary', 'festival');
