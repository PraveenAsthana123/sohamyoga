-- Survey Management consent + quality-detection layer. Gap-analysis found the
-- existing 11-table survey engine mature but missing exactly this: no consent
-- capture on responses, no response-quality signal at all. Additive only --
-- does not touch existing tables' existing columns.

ALTER TABLE survey ADD COLUMN IF NOT EXISTS consent_required BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE survey ADD COLUMN IF NOT EXISTS consent_text TEXT NOT NULL DEFAULT
  'I agree to have my feedback used to improve services.';

ALTER TABLE survey_response ADD COLUMN IF NOT EXISTS consent_given BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE survey_response ADD COLUMN IF NOT EXISTS quality_flags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE survey_response ADD COLUMN IF NOT EXISTS quality_score NUMERIC(5,2);

CREATE INDEX IF NOT EXISTS idx_survey_response_ip_recent ON survey_response (survey_id, ip_address, submitted_at DESC);
