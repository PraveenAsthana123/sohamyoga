-- CSAT scoring -- survey_analytics.nps_score has a real writer
-- (NpsCalculationJob.ts); csat_score did not exist at all. Reuses the
-- existing real survey/survey_question/survey_response infrastructure --
-- no new survey system, just a second real metric computed from a
-- 'feedback'-type survey's rating_scale question. CES (Customer Effort
-- Score) deliberately NOT added here -- it needs a real, distinguishable
-- "how much effort" question type this schema has no way to tell apart
-- from a CSAT "how satisfied" rating_scale question yet; adding an unused
-- column now would repeat the exact dead-column pattern flagged elsewhere
-- this session (family_seat, price_history).
ALTER TABLE survey_analytics ADD COLUMN IF NOT EXISTS csat_score NUMERIC(5,2);
ALTER TABLE survey_analytics ADD CONSTRAINT analytics_csat_range CHECK (csat_score IS NULL OR (csat_score >= 0 AND csat_score <= 100));
