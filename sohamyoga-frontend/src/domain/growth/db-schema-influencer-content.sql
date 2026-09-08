-- Content Submission + Publishing tracking -- real proof-of-work fields on
-- influencer_collaboration, distinct stages: submitted (pre-review) vs
-- published (actually live), both staff-recorded URLs, not a fabricated
-- automated content pipeline.
ALTER TABLE influencer_collaboration ADD COLUMN IF NOT EXISTS submitted_content_url TEXT;
ALTER TABLE influencer_collaboration ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE influencer_collaboration ADD COLUMN IF NOT EXISTS published_content_url TEXT;
ALTER TABLE influencer_collaboration ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
