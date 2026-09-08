-- Negative Virality / Crisis detection -- mirrors ViralDetectionJob's real
-- z-score-against-own-baseline methodology, applied to sentiment_log
-- negative-volume instead of share velocity. A crisis is a real
-- statistical outlier in negative-sentiment volume, not a fixed magic
-- number of complaints.
CREATE TABLE IF NOT EXISTS crisis_signal (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  window_date      DATE          NOT NULL UNIQUE,
  negative_count   INTEGER       NOT NULL,
  baseline_mean    NUMERIC(10,3),
  baseline_stddev  NUMERIC(10,3),
  baseline_days    INTEGER       NOT NULL,
  z_score          NUMERIC(10,3),
  is_crisis        BOOLEAN       NOT NULL DEFAULT FALSE,
  computed_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crisis_signal_date ON crisis_signal (window_date DESC);
