-- Sentiment analysis log. Populated two ways: (1) manually, via the admin
-- "Analyze text" tool in the Social Portal, for ad hoc use (a pasted review,
-- DM, email) — works today with zero connected social accounts; (2)
-- automatically, when read_comments pulls real platform comments through
-- Postiz — currently no accounts are connected so this path has nothing to
-- process yet, but the wiring is real.

CREATE TABLE IF NOT EXISTS sentiment_log (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  source        VARCHAR(20)  NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','comment','review')),
  platform      VARCHAR(30),                 -- set when source='comment'
  reference_id  VARCHAR(100),                -- e.g. Postiz comment id, when known
  text_content  TEXT         NOT NULL,
  sentiment     VARCHAR(10)  NOT NULL CHECK (sentiment IN ('positive','neutral','negative')),
  confidence    NUMERIC(4,3),                -- 0.000-1.000, when the model provides one
  reason        TEXT         NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sentiment_log_sentiment ON sentiment_log(sentiment, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment_log_platform  ON sentiment_log(platform) WHERE platform IS NOT NULL;
