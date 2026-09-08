-- Brand Asset Library -- brand_kit only ever had 2 single-value logo
-- fields (logo_url, dark_logo_url), no way to catalog the broader set of
-- real brand assets (product photos, banners, icon variants) a studio
-- actually accumulates. Real multi-asset library + detail view.
CREATE TABLE IF NOT EXISTS brand_asset (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_kit_id  UUID          NOT NULL REFERENCES brand_kit(id) ON DELETE CASCADE,
  name          VARCHAR(160)  NOT NULL,
  asset_type    VARCHAR(30)   NOT NULL CHECK (asset_type IN ('logo','photo','banner','icon','video','document','other')),
  url           TEXT          NOT NULL,
  notes         TEXT          NOT NULL DEFAULT '',
  uploaded_by   VARCHAR(120)  NOT NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brand_asset_kit ON brand_asset (brand_kit_id, asset_type);
