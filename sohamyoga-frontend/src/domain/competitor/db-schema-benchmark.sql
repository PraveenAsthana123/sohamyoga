-- Competitor Benchmark Engine, added 2026-09-14 -- backlog item #4,
-- extends the existing real competitor/ price-tracking domain (see
-- db-schema.sql's own header: "no external API can honestly fetch a
-- competitor's real data — the real, buildable feature is admin-entered
-- observation, tracked over time"). Same honesty pattern applied to a
-- wider set of real dimensions than price alone.

CREATE TABLE IF NOT EXISTS competitor_benchmark_score (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id  UUID          NOT NULL REFERENCES competitor(id) ON DELETE CASCADE,
  dimension      VARCHAR(30)   NOT NULL CHECK (dimension IN (
    'discoverability','website_quality','seo','local_presence',
    'reputation','social_presence','content_quality','pricing_competitiveness'
  )),
  score          SMALLINT      NOT NULL CHECK (score BETWEEN 0 AND 100), -- real admin-observed rating, never auto-fetched
  observed_at    DATE          NOT NULL,
  notes          TEXT          NOT NULL DEFAULT '', -- what the admin actually observed to justify this score
  created_by     TEXT          NOT NULL,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (competitor_id, dimension, observed_at)
);

CREATE INDEX IF NOT EXISTS idx_competitor_benchmark_competitor ON competitor_benchmark_score(competitor_id, observed_at DESC);
