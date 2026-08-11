-- student.status defaulted to 'onboarding', a value that only exists in
-- ref_student_journey_phase (the FK target of the separate journey_phase
-- column), not ref_student_status (status's actual FK target: active/
-- inactive/paused/graduated/dropped). Copy-paste bug — any INSERT INTO
-- student that didn't explicitly override status has been failing the FK
-- constraint since this table was created. Confirmed live 2026-08-11.

ALTER TABLE student ALTER COLUMN status SET DEFAULT 'active';
