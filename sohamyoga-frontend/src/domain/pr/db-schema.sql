-- PR & Earned Media Engine, added 2026-09-14 -- backlog item #30/30
-- (final item in the 2026-09-14 roadmap backlog). No press-release
-- distribution or media-monitoring API exists or is invoked here
-- (confirmed absent). Real, admin-entered media mention logging --
-- same honest pattern as GEO Visibility (#9) and Competitor Benchmark
-- (#4) observations this session.

CREATE TABLE IF NOT EXISTS media_mention (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID          NOT NULL,
  source_name    TEXT          NOT NULL, -- real publication/outlet/podcast name
  mention_type   VARCHAR(20)   NOT NULL CHECK (mention_type IN ('press_coverage','podcast','guest_post','award','speaking','social_share')),
  url            TEXT,
  sentiment      VARCHAR(10)   CHECK (sentiment IN ('positive','neutral','negative')),
  excerpt        TEXT          NOT NULL DEFAULT '', -- what was actually said/covered
  observed_at    DATE          NOT NULL DEFAULT CURRENT_DATE,
  created_by     TEXT          NOT NULL,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_mention_tenant ON media_mention (tenant_id, observed_at DESC);
