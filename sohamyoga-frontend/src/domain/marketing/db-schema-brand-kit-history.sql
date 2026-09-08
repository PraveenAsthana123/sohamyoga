-- Version Management for brand_kit -- every PATCH (colors, phrases, hashtags)
-- silently overwrote the row with zero history. Snapshot the prior state
-- before each write so admins can see what a guideline used to say and who
-- changed it.
CREATE TABLE IF NOT EXISTS brand_kit_history (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_kit_id     UUID NOT NULL REFERENCES brand_kit(id) ON DELETE CASCADE,
  version          INT NOT NULL,
  snapshot         JSONB NOT NULL,
  changed_action   TEXT NOT NULL,
  changed_by       TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (brand_kit_id, version)
);
CREATE INDEX IF NOT EXISTS idx_brand_kit_history_kit ON brand_kit_history(brand_kit_id, version DESC);
