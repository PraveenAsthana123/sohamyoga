-- Migration 162 (2026-09-08): real lateness-threshold policy for booking.
-- Closes: "No lateness-threshold policy or tracking exists yet --
-- checked_in_at is recorded, but nothing computes minutes-late against
-- class start time." The raw ingredients (attendance_record.attended_at,
-- class_session.session_date/start_time) were already real; only the
-- policy threshold and the computation were missing.
CREATE TABLE IF NOT EXISTS attendance_policy (
  tenant_id             UUID PRIMARY KEY,
  late_threshold_minutes INTEGER NOT NULL DEFAULT 10 CHECK (late_threshold_minutes >= 0),
  updated_by            TEXT,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
