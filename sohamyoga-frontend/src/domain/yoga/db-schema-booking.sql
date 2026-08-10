-- Class scheduling + booking + waitlist. Nothing backed the Booking admin page
-- before this — no course/class_session/booking/waitlist table existed anywhere,
-- and attendance_record.class_session_id already referenced a table that had
-- never been created. Reasonable-default policy (documented, editable later):
-- 24hr cancellation window, 3-strike no-show suspension, waitlist auto-promotes
-- 2hrs before class, 14-day advance booking limit, 3 concurrent bookings/day.

CREATE TABLE IF NOT EXISTS class_session (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID         NOT NULL,
  class_name     VARCHAR(160) NOT NULL,
  teacher_name   VARCHAR(160) NOT NULL,
  session_date   DATE         NOT NULL,
  start_time     TIME         NOT NULL,
  duration_minutes INTEGER    NOT NULL DEFAULT 60,
  location       VARCHAR(200),
  capacity       INTEGER      NOT NULL CHECK (capacity > 0),
  status         VARCHAR(20)  NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled')),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_class_session_date ON class_session(tenant_id, session_date, start_time);

CREATE TABLE IF NOT EXISTS booking (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID         NOT NULL,
  class_session_id UUID         NOT NULL REFERENCES class_session(id) ON DELETE CASCADE,
  student_id       UUID         NOT NULL REFERENCES student(id) ON DELETE CASCADE,
  status           VARCHAR(20)  NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','checked_in','no_show','cancelled')),
  channel          VARCHAR(20)  NOT NULL DEFAULT 'web' CHECK (channel IN ('app','web','front_desk','phone','qr')),
  booked_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  checked_in_at    TIMESTAMPTZ,
  cancelled_at     TIMESTAMPTZ,

  UNIQUE (class_session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_booking_session ON booking(class_session_id, status);
CREATE INDEX IF NOT EXISTS idx_booking_student ON booking(student_id, status);

CREATE TABLE IF NOT EXISTS waitlist_entry (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID         NOT NULL,
  class_session_id UUID         NOT NULL REFERENCES class_session(id) ON DELETE CASCADE,
  student_id       UUID         NOT NULL REFERENCES student(id) ON DELETE CASCADE,
  position         INTEGER      NOT NULL,
  notify_method    VARCHAR(40)  NOT NULL DEFAULT 'email',
  status           VARCHAR(20)  NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','promoted','expired','cancelled')),
  joined_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  resolved_at      TIMESTAMPTZ,

  UNIQUE (class_session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_waitlist_session ON waitlist_entry(class_session_id, position);
