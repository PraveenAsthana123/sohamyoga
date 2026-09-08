-- Migration 163 (2026-09-08): real teacher ratings for booking.
-- Closes the final booking sub-gap: "Teacher ratings genuinely have no
-- backing schema anywhere in this app" (admin/attendance previously
-- labeled the Teachers tab NotYetAvailable for exactly this reason).
-- One rating per booking (a booking already represents one student's
-- attendance at one class_session with one teacher_name) rather than a
-- new normalized FK to teacher_profile -- class_session.teacher_name is
-- itself plain text, not FK'd, so this matches the app's existing
-- convention instead of forcing an unrelated normalization effort.
CREATE TABLE IF NOT EXISTS teacher_rating (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL,
  booking_id   UUID NOT NULL REFERENCES booking(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES student(id) ON DELETE CASCADE,
  teacher_name VARCHAR NOT NULL,
  rating       SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (booking_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_rating_teacher ON teacher_rating (tenant_id, teacher_name);
