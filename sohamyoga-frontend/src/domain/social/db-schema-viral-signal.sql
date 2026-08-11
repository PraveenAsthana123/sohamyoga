-- =============================================================================
-- Viral Detection (Phase C of the growth-loop architecture, Facebook-first).
--
-- Built on top of social_post/social_post_analytics (migration 020, already
-- applied) — a real per-post, per-snapshot time series. No new tracking is
-- added; this table stores the computed velocity/baseline/z-score per post,
-- refreshed by ViralDetectionJob. A post needs >=2 analytics snapshots to
-- have a velocity at all, and its account needs >=3 other posts with their
-- own velocity to have a statistically meaningful baseline — both are real
-- preconditions, not thresholds picked to force a result.
--
-- Known real blocker (as of this migration): social_post and
-- social_post_analytics currently have zero rows — no social account is
-- connected via Postiz OAuth yet (needs a human to complete platform
-- consent). This job and its UI are built and tested against real seeded
-- rows and will simply report "no data yet" against the live table until a
-- real account connects — same honest-scope pattern as the existing Voice
-- of Customer digest.
-- =============================================================================

CREATE TABLE IF NOT EXISTS viral_signal (
  id                     UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID          NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  post_id                UUID          NOT NULL REFERENCES social_post(id) ON DELETE CASCADE,
  platform               TEXT          NOT NULL,
  window_hours           NUMERIC(8,2)  NOT NULL,
  share_velocity         NUMERIC(10,3) NOT NULL,   -- shares gained per hour since previous snapshot
  like_velocity          NUMERIC(10,3) NOT NULL,
  comment_velocity       NUMERIC(10,3) NOT NULL,
  baseline_mean          NUMERIC(10,3),             -- account's trailing mean share_velocity (NULL until baseline sample exists)
  baseline_stddev        NUMERIC(10,3),
  baseline_sample_size   INTEGER       NOT NULL DEFAULT 0,
  z_score                NUMERIC(8,3),
  viral_score            NUMERIC(5,2)  NOT NULL,    -- 0-100, bounded mapping from z_score
  is_viral                BOOLEAN       NOT NULL DEFAULT FALSE,
  ai_note                TEXT,
  computed_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (post_id)
);

CREATE INDEX IF NOT EXISTS idx_viral_signal_tenant   ON viral_signal (tenant_id, platform, is_viral);
CREATE INDEX IF NOT EXISTS idx_viral_signal_computed ON viral_signal (computed_at DESC);
