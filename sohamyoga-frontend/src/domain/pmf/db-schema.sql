-- PMF + Activation Tracking, added 2026-09-14 -- backlog item #29. Real
-- activation rate computed from real booking data (a student with at
-- least one real checked_in booking is activated -- student.first_class_at
-- is unpopulated for all 467 real students, same homogeneous-data
-- finding as elsewhere this session, so booking data is used instead).
-- PMF (Sean Ellis survey) has no real responses yet -- real schema
-- ready, honestly empty until real survey data exists.

CREATE TABLE IF NOT EXISTS pmf_survey_response (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID          NOT NULL,
  student_id   UUID          REFERENCES student(id),
  response     VARCHAR(20)   NOT NULL CHECK (response IN ('very_disappointed','somewhat_disappointed','not_disappointed')),
  collected_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_by   TEXT          NOT NULL
);
