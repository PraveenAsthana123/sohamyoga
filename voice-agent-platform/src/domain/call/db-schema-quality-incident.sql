-- Real, honest slice of "quality matrix" (Topic I) and "dispute/incident
-- catalog" (Topic G): a human-entered quality score and incident flag per
-- call. NOT sentiment-analysis/ML-derived -- no such pipeline exists here,
-- and fabricating one would violate this project's no-fake-scores rule.
ALTER TABLE call_log ADD COLUMN IF NOT EXISTS quality_score SMALLINT CHECK (quality_score IS NULL OR quality_score BETWEEN 1 AND 5);
ALTER TABLE call_log ADD COLUMN IF NOT EXISTS is_incident BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE call_log ADD COLUMN IF NOT EXISTS incident_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_call_log_incident ON call_log(is_incident) WHERE is_incident = TRUE;
