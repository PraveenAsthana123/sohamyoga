-- CES (Customer Effort Score) -- the third leg of the real CX metric trio
-- (NPS, CSAT already real via NpsCalculationJob.ts/CsatCalculationJob.ts).
-- Mirrors both exactly: a dedicated 'ces' survey type + a real top-2-box
-- computation on the question's own rating scale, not a fabricated number.
ALTER TABLE survey DROP CONSTRAINT IF EXISTS survey_type_check;
ALTER TABLE survey ADD CONSTRAINT survey_type_check CHECK (type IN
  ('survey','questionnaire','form','quiz','assessment','poll','nps','feedback','ces'));

ALTER TABLE survey_analytics ADD COLUMN IF NOT EXISTS ces_score NUMERIC(5,2);
ALTER TABLE survey_analytics ADD CONSTRAINT analytics_ces_range CHECK (ces_score IS NULL OR (ces_score >= 0 AND ces_score <= 100));
