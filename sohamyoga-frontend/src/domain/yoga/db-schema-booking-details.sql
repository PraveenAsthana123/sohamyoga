-- Closes the real gap found in the 2026-08-31 module audit: the customer
-- booking pages (/booking, /booking/[classId]) were pure mock UI displaying
-- level/style/price fields that had no real column anywhere on class_session
-- — this is the minimal, real extension needed to make that data genuine
-- rather than removing the fields the business actually needs to show.
ALTER TABLE class_session ADD COLUMN IF NOT EXISTS level VARCHAR(20) CHECK (level IN ('Beginner','Intermediate','Advanced'));
ALTER TABLE class_session ADD COLUMN IF NOT EXISTS style VARCHAR(60);
ALTER TABLE class_session ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0);
