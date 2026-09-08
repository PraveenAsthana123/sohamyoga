-- Sampling Management -- links a research_project to the real survey engine
-- (survey/survey_invitation/survey_response) it's fielding, so the project
-- portfolio can show real recruitment funnel numbers instead of a fabricated
-- sample-size widget with nothing behind it.
ALTER TABLE research_project ADD COLUMN IF NOT EXISTS survey_id UUID REFERENCES survey(id);
ALTER TABLE research_project ADD COLUMN IF NOT EXISTS target_sample_size INTEGER CHECK (target_sample_size IS NULL OR target_sample_size > 0);
