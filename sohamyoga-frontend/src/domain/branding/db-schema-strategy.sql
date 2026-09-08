-- Brand Strategy -- the missing strategic layer above the operational
-- brand_kit governance (logo/color/typography). Powers the Branding
-- Control Tower's Brand Strategy Screen and Brand Positioning Map, which
-- are conceptually distinct from brand_kit: mission/audience/competitive
-- position, not visual-asset rules.
CREATE TABLE IF NOT EXISTS brand_strategy (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID          NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  mission               TEXT          NOT NULL DEFAULT '',
  vision                TEXT          NOT NULL DEFAULT '',
  target_audience       TEXT          NOT NULL DEFAULT '',
  key_differentiators   TEXT[]        NOT NULL DEFAULT '{}',
  updated_by            VARCHAR(120)  NOT NULL,
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_brand_strategy_tenant ON brand_strategy (tenant_id);

-- Positioning map: named competitors plotted on price (1-10, low-high) vs
-- quality/premium perception (1-10, low-high). "self" row is this studio's
-- own position, entered by staff, not fabricated market data.
CREATE TABLE IF NOT EXISTS brand_positioning_entry (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID          NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  label          VARCHAR(120)  NOT NULL,
  is_self        BOOLEAN       NOT NULL DEFAULT FALSE,
  price_position SMALLINT      NOT NULL CHECK (price_position BETWEEN 1 AND 10),
  quality_position SMALLINT    NOT NULL CHECK (quality_position BETWEEN 1 AND 10),
  notes          TEXT          NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_brand_positioning_self ON brand_positioning_entry (tenant_id) WHERE is_self = TRUE;
CREATE INDEX IF NOT EXISTS idx_brand_positioning_tenant ON brand_positioning_entry (tenant_id);
